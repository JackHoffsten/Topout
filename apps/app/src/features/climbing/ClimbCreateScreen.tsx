import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import type { ScrollView } from 'react-native';
import { z } from 'zod';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { dateKey } from '../calendar/calendar';
import { ClimbEditor } from './ClimbEditor';

export function ClimbCreateScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { date, returnTo } = useLocalSearchParams<{ date?: string; returnTo?: string }>();
  const initialDate = date ?? dateKey(new Date());
  const valid = z.iso.date().safeParse(initialDate).success && initialDate >= '0001-01-01';
  const close = (savedDate?: string) => {
    if (returnTo === 'climbs') router.replace('/climbs');
    else
      router.replace({
        pathname: '/calendar',
        params: { date: savedDate ?? (valid ? initialDate : dateKey(new Date())) },
      });
  };
  return (
    <Page scrollRef={scrollRef}>
      <Heading large>Log climb</Heading>
      {valid ? (
        <ClimbEditor
          key={initialDate}
          date={initialDate}
          showHeading={false}
          onClose={close}
          scrollRef={scrollRef}
        />
      ) : (
        <>
          <ErrorNotice message="Choose a valid calendar date." />
          <Button title="Back" variant="secondary" onPress={() => close()} />
        </>
      )}
    </Page>
  );
}
