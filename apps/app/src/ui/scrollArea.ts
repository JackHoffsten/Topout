import { createContext, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

export type ScrollMetrics = {
  top: number;
  left: number;
  width: number;
  height: number;
  contentHeight: number;
  offset: number;
};
export const ScrollAreaContext = createContext<{
  ref: RefObject<ScrollView | null>;
  metrics: RefObject<ScrollMetrics>;
  interaction: RefObject<number>;
  scrollTo: (offset: number) => void;
} | null>(null);
