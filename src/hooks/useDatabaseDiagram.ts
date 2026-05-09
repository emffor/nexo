'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDatabaseDiagram,
  resetDatabaseDiagram,
  saveDatabaseDiagramRecord,
} from '../lib/databaseDiagramStore';
import { touchProject } from '../lib/projects';
import {
  reconcileDatabaseVisualState,
  remapDatabaseVisualStateForColumnRename,
  remapDatabaseVisualStateForTableRename,
} from '../lib/databaseDiagramSync';
import { parseDbml, renameDbmlColumn, renameDbmlTable } from '../lib/dbml';
import type {
  DatabaseDiagramParseResult,
  DatabaseDiagramRecord,
  DatabaseDiagramVisualState,
} from '../types/database';

const DATABASE_AUTOSAVE_DELAY_MS = 250;
const DATABASE_STABLE_DELAY_MS = 450;

interface UseDatabaseDiagramOptions {
  projectId?: string;
  onAutosaveError?: () => void;
}

export interface UseDatabaseDiagramResult {
  databaseDiagram: DatabaseDiagramRecord | null;
  databaseParseResult: DatabaseDiagramParseResult;
  databaseResetSignal: number;
  getCurrentDatabaseDiagram: () => Promise<DatabaseDiagramRecord>;
  onDatabaseContentChange: (next: string) => void;
  onDatabaseStateChange: (next: DatabaseDiagramVisualState) => void;
  onRenameDatabaseTable: (tableName: string, nextName: string) => boolean;
  onRenameDatabaseColumn: (
    tableName: string,
    columnName: string,
    nextName: string,
  ) => boolean;
  replaceDatabaseDiagramRecord: (
    record: Partial<DatabaseDiagramRecord> & { content: string },
  ) => Promise<DatabaseDiagramRecord>;
  resetDatabaseDiagramToDefault: () => Promise<DatabaseDiagramRecord>;
}

function buildPersistableRecord(
  record: DatabaseDiagramRecord,
): Partial<DatabaseDiagramRecord> & { content: string } {
  return {
    title: record.title,
    content: record.content,
    state: record.state,
    createdAt: record.createdAt,
  };
}

export function useDatabaseDiagram({
  projectId = 'main',
  onAutosaveError,
}: UseDatabaseDiagramOptions = {}): UseDatabaseDiagramResult {
  const [databaseDiagram, setDatabaseDiagram] =
    useState<DatabaseDiagramRecord | null>(null);
  const [databaseResetSignal, setDatabaseResetSignal] = useState(0);
  const [isContentStable, setIsContentStable] = useState(true);

  const databaseDiagramRef = useRef<DatabaseDiagramRecord | null>(null);
  const pendingSnapshotRef = useRef<DatabaseDiagramRecord | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const hasAutosaveErrorRef = useRef(false);
  const onAutosaveErrorRef = useRef(onAutosaveError);

  useEffect(() => {
    onAutosaveErrorRef.current = onAutosaveError;
  }, [onAutosaveError]);

  const databaseParseResult = useMemo(
    () => parseDbml(databaseDiagram?.content ?? ''),
    [databaseDiagram?.content],
  );

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const clearStableTimer = useCallback(() => {
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
  }, []);

  const persistSnapshot = useCallback(
    (snapshot: DatabaseDiagramRecord): Promise<void> => {
      const save = async () => {
        try {
          await saveDatabaseDiagramRecord(buildPersistableRecord(snapshot), projectId);
          await touchProject(projectId);
          hasAutosaveErrorRef.current = false;
        } catch {
          if (!hasAutosaveErrorRef.current) {
            hasAutosaveErrorRef.current = true;
            onAutosaveErrorRef.current?.();
          }
        }
      };

      const queuedSave = autosaveQueueRef.current.then(save, save);
      autosaveQueueRef.current = queuedSave.catch(() => undefined);
      return queuedSave;
    },
    [projectId],
  );

  const flushPendingSnapshot = useCallback(async () => {
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    pendingSnapshotRef.current = null;
    clearAutosaveTimer();
    await persistSnapshot(snapshot);
  }, [clearAutosaveTimer, persistSnapshot]);

  const scheduleSnapshotSave = useCallback(
    (snapshot: DatabaseDiagramRecord) => {
      pendingSnapshotRef.current = snapshot;
      clearAutosaveTimer();
      autosaveTimerRef.current = setTimeout(() => {
        void flushPendingSnapshot();
      }, DATABASE_AUTOSAVE_DELAY_MS);
    },
    [clearAutosaveTimer, flushPendingSnapshot],
  );

  const markContentAsEditing = useCallback(() => {
    clearStableTimer();
    setIsContentStable(false);
    stableTimerRef.current = setTimeout(() => {
      setIsContentStable(true);
      stableTimerRef.current = null;
    }, DATABASE_STABLE_DELAY_MS);
  }, [clearStableTimer]);

  const markContentAsStable = useCallback(() => {
    clearStableTimer();
    setIsContentStable(true);
  }, [clearStableTimer]);

  const cancelPendingSnapshot = useCallback(() => {
    pendingSnapshotRef.current = null;
    clearAutosaveTimer();
  }, [clearAutosaveTimer]);

  const applyDatabaseUpdate = useCallback(
    (
      updater: (current: DatabaseDiagramRecord) => DatabaseDiagramRecord,
    ): DatabaseDiagramRecord | null => {
      const current = databaseDiagramRef.current;
      if (!current) {
        return null;
      }

      const next = updater(current);
      databaseDiagramRef.current = next;
      setDatabaseDiagram(next);
      scheduleSnapshotSave(next);
      return next;
    },
    [scheduleSnapshotSave],
  );

  useEffect(() => {
    let active = true;
    databaseDiagramRef.current = null;
    setDatabaseDiagram(null);

    void getDatabaseDiagram(projectId).then((record) => {
      if (!active) {
        return;
      }
      databaseDiagramRef.current = record;
      setDatabaseDiagram(record);
      markContentAsStable();
    });

    return () => {
      active = false;
    };
  }, [markContentAsStable, projectId]);

  useEffect(() => {
    const handlePageHide = () => {
      void flushPendingSnapshot();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      clearStableTimer();
      void flushPendingSnapshot();
    };
  }, [clearStableTimer, flushPendingSnapshot]);

  useEffect(() => {
    const current = databaseDiagramRef.current;
    if (!current) {
      return;
    }

    const isDbmlValid = databaseParseResult.errors.length === 0;
    const nextState = reconcileDatabaseVisualState({
      state: current.state,
      tables: databaseParseResult.tables,
      relations: databaseParseResult.relations,
      isDbmlValid,
      canPruneOrphans: isDbmlValid && isContentStable,
    });

    if (nextState !== current.state) {
      applyDatabaseUpdate((record) => ({ ...record, state: nextState }));
    }
  }, [applyDatabaseUpdate, databaseParseResult, isContentStable]);

  const getCurrentDatabaseDiagram = useCallback(async () => {
    if (databaseDiagramRef.current) {
      return databaseDiagramRef.current;
    }

    const record = await getDatabaseDiagram(projectId);
    databaseDiagramRef.current = record;
    setDatabaseDiagram(record);
    return record;
  }, [projectId]);

  const onDatabaseContentChange = useCallback(
    (next: string) => {
      markContentAsEditing();
      applyDatabaseUpdate((current) => ({ ...current, content: next }));
    },
    [applyDatabaseUpdate, markContentAsEditing],
  );

  const onDatabaseStateChange = useCallback(
    (next: DatabaseDiagramVisualState) => {
      applyDatabaseUpdate((current) => ({ ...current, state: next }));
    },
    [applyDatabaseUpdate],
  );

  const onRenameDatabaseTable = useCallback(
    (tableName: string, nextName: string): boolean => {
      const current = databaseDiagramRef.current;
      if (!current) {
        return false;
      }

      const nextContent = renameDbmlTable(current.content, tableName, nextName);
      if (nextContent === current.content && tableName !== nextName) {
        return false;
      }

      const previousParseResult = parseDbml(current.content);
      const nextParseResult = parseDbml(nextContent);
      const remappedState = remapDatabaseVisualStateForTableRename({
        state: current.state,
        previousRelations: previousParseResult.relations,
        nextRelations: nextParseResult.relations,
        currentName: tableName,
        nextName,
      });
      const isDbmlValid = nextParseResult.errors.length === 0;
      const nextState = reconcileDatabaseVisualState({
        state: remappedState,
        tables: nextParseResult.tables,
        relations: nextParseResult.relations,
        isDbmlValid,
        canPruneOrphans: isDbmlValid,
      });

      markContentAsStable();
      applyDatabaseUpdate((record) => ({
        ...record,
        content: nextContent,
        state: nextState,
      }));
      return true;
    },
    [applyDatabaseUpdate, markContentAsStable],
  );

  const onRenameDatabaseColumn = useCallback(
    (tableName: string, columnName: string, nextName: string): boolean => {
      const current = databaseDiagramRef.current;
      if (!current) {
        return false;
      }

      const nextContent = renameDbmlColumn(
        current.content,
        tableName,
        columnName,
        nextName,
      );
      if (nextContent === current.content && columnName !== nextName) {
        return false;
      }

      const previousParseResult = parseDbml(current.content);
      const nextParseResult = parseDbml(nextContent);
      const remappedState = remapDatabaseVisualStateForColumnRename({
        state: current.state,
        previousRelations: previousParseResult.relations,
        nextRelations: nextParseResult.relations,
        tableName,
        currentName: columnName,
        nextName,
      });
      const isDbmlValid = nextParseResult.errors.length === 0;
      const nextState = reconcileDatabaseVisualState({
        state: remappedState,
        tables: nextParseResult.tables,
        relations: nextParseResult.relations,
        isDbmlValid,
        canPruneOrphans: isDbmlValid,
      });

      markContentAsStable();
      applyDatabaseUpdate((record) => ({
        ...record,
        content: nextContent,
        state: nextState,
      }));
      return true;
    },
    [applyDatabaseUpdate, markContentAsStable],
  );

  const replaceDatabaseDiagramRecord = useCallback(
    async (record: Partial<DatabaseDiagramRecord> & { content: string }) => {
      cancelPendingSnapshot();
      markContentAsStable();
      const next = await saveDatabaseDiagramRecord(record, projectId);
      await touchProject(projectId);
      databaseDiagramRef.current = next;
      setDatabaseDiagram(next);
      return next;
    },
    [cancelPendingSnapshot, markContentAsStable, projectId],
  );

  const resetDatabaseDiagramToDefault = useCallback(async () => {
    cancelPendingSnapshot();
    markContentAsStable();
    const next = await resetDatabaseDiagram(projectId);
    await touchProject(projectId);
    databaseDiagramRef.current = next;
    setDatabaseDiagram(next);
    setDatabaseResetSignal((value) => value + 1);
    return next;
  }, [cancelPendingSnapshot, markContentAsStable, projectId]);

  return {
    databaseDiagram,
    databaseParseResult,
    databaseResetSignal,
    getCurrentDatabaseDiagram,
    onDatabaseContentChange,
    onDatabaseStateChange,
    onRenameDatabaseTable,
    onRenameDatabaseColumn,
    replaceDatabaseDiagramRecord,
    resetDatabaseDiagramToDefault,
  };
}
