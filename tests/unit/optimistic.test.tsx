import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOptimisticToggle } from '@/components/ui/useOptimisticToggle';

describe('useOptimisticToggle', () => {
  it('paints the new value synchronously, then defers to the stored value', async () => {
    let resolve: () => void = () => {};
    const write = () => new Promise<void>((r) => (resolve = r));
    const { result, rerender } = renderHook(({ stored }) => useOptimisticToggle(stored, write), {
      initialProps: { stored: false },
    });

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true); // before the write resolves

    await act(async () => resolve());
    rerender({ stored: true }); // live query caught up
    expect(result.current[0]).toBe(true);
    rerender({ stored: false }); // a later remote change wins
    expect(result.current[0]).toBe(false);
  });

  it('rolls back when the write fails', async () => {
    const { result } = renderHook(() =>
      useOptimisticToggle(false, () => Promise.reject(new Error('quota'))),
    );
    await act(async () => result.current[1](true));
    expect(result.current[0]).toBe(false);
  });
});
