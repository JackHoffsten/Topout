import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

export type SaveFeedback = { label: string; phase: 'saving' | 'saved' | 'error' | 'partial' };
type Notice = SaveFeedback & { source: string; token: number; origin: string; detached: boolean };
const Context = createContext<{
  scope: string;
  notices: Notice[];
  report: (notice: Notice) => void;
  detach: (source: string) => void;
  clear: (source: string) => void;
} | null>(null);

export function SaveFeedbackProvider({ scope, children }: PropsWithChildren<{ scope: string }>) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const report = useCallback((notice: Notice) => {
    setNotices((current) => [...current.filter((n) => n.source !== notice.source), notice]);
    if (notice.phase !== 'saving') {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setNotices((current) =>
          current.filter((n) => n.source !== notice.source || n.token !== notice.token),
        );
      }, 3000);
      timers.current.add(timer);
    }
  }, []);
  const detach = useCallback((source: string) => {
    setNotices((current) =>
      current.map((notice) => (notice.source === source ? { ...notice, detached: true } : notice)),
    );
  }, []);
  const clear = useCallback(
    (source: string) => setNotices((current) => current.filter((n) => n.source !== source)),
    [],
  );
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  return (
    <Context.Provider value={{ scope, notices, report, detach, clear }}>
      {children}
    </Context.Provider>
  );
}

export function useCarriedSaveFeedback() {
  const context = useContext(Context);
  return context?.notices.filter((n) => n.detached || n.origin !== context.scope) ?? [];
}

export function useSaveFeedback(label: string, partialFailure?: (error: unknown) => boolean) {
  const context = useContext(Context);
  const source = useId();
  const generation = useRef(0);
  const mounted = useRef(true);
  const [feedback, setFeedback] = useState<SaveFeedback>();
  const report = context?.report;
  const detach = context?.detach;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      detach?.(source);
    };
  }, [detach, source]);
  useEffect(() => {
    if (!feedback || feedback.phase === 'saving') return;
    const timer = setTimeout(() => setFeedback(undefined), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    const token = ++generation.current;
    const origin = context?.scope ?? '';
    const update = (phase: SaveFeedback['phase']) => {
      if (generation.current !== token) return;
      const next = { label, phase };
      if (mounted.current) setFeedback(next);
      report?.({ ...next, source, token, origin, detached: !mounted.current });
      if (Platform.OS !== 'web')
        AccessibilityInfo.announceForAccessibility(
          `${label}: ${phase === 'saving' ? 'Saving' : phase === 'saved' ? 'Saved' : phase === 'partial' ? 'Partially saved' : 'Not saved'}`,
        );
    };
    update('saving');
    try {
      const result = await action();
      update('saved');
      return result;
    } catch (error) {
      update(partialFailure?.(error) ? 'partial' : 'error');
      throw error;
    }
  };
  const reset = () => {
    ++generation.current;
    setFeedback(undefined);
    context?.clear(source);
  };
  return { feedback, run, reset };
}

export function useSaveMutation<TData, TVariables = void>(
  label: string,
  options: Omit<UseMutationOptions<TData, Error, TVariables>, 'onMutate'> & {
    mutationFn: NonNullable<UseMutationOptions<TData, Error, TVariables>['mutationFn']>;
  },
  partialFailure?: (error: unknown) => boolean,
) {
  const { feedback, run, reset } = useSaveFeedback(label, partialFailure);
  const mutation = useMutation({
    ...options,
    onSuccess: undefined,
    mutationFn: (input: TVariables, context) =>
      run(async () => {
        const result = await options.mutationFn(input, context);
        // Publish success after navigation/closing so the destination receives its full confirmation.
        await options.onSuccess?.(result, input, undefined, context);
        return result;
      }),
  });
  return {
    ...mutation,
    feedback,
    reset: () => {
      mutation.reset();
      reset();
    },
  };
}
