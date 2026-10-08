import { useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { View, type ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../lib/providers';
import { SearchField } from './SearchField';
import { LocationSuggestion } from './LocationSuggestion';
import { ErrorNotice } from './ErrorNotice';
import { SearchFocus } from '../searchFocus';

export function LocationField({
  activity,
  value,
  onChange,
  onSelect,
  disabled = false,
  scrollRef,
}: {
  activity: 'workout' | 'climb';
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  disabled?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { api } = useSession();
  const fallbackScroll = useRef<ScrollView>(null);
  const focusSearch = useContext(SearchFocus);
  useEffect(() => () => focusSearch(null), [focusSearch]);
  const [focused, setFocused] = useState(false);
  const [term, setTerm] = useState(value.trim());
  useEffect(() => {
    const timer = setTimeout(() => setTerm(value.trim()), 150);
    return () => clearTimeout(timer);
  }, [value]);
  const query = useQuery({
    queryKey: ['log-locations', activity, term],
    queryFn: () => api.listLogLocations(activity, term),
    enabled: focused && !disabled,
    staleTime: 0,
  });
  const suggestions = (query.data ?? []).filter(
    (location) =>
      location.toLowerCase().includes(value.trim().toLowerCase()) &&
      location.toLowerCase() !== value.trim().toLowerCase(),
  );
  const selectLocation = (location: string) => {
    onChange(location);
    onSelect?.(location);
    setFocused(false);
    focusSearch(null);
  };
  return (
    <View style={{ gap: 8 }}>
      <SearchField
        scrollRef={scrollRef ?? fallbackScroll}
        label="Location (optional)"
        value={value}
        maxLength={200}
        editable={!disabled}
        autoCapitalize="words"
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          focusSearch(null);
        }}
        onChangeText={(next) => {
          setFocused(true);
          onChange(next);
        }}
      />
      {focused &&
        suggestions.map((location) => (
          <LocationSuggestion
            key={location}
            location={location}
            disabled={disabled}
            onSelect={selectLocation}
          />
        ))}
      {focused && query.isError && (
        <ErrorNotice message="Location suggestions could not be loaded. You can still enter a location." />
      )}
    </View>
  );
}
