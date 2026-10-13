import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Button } from '../../ui/components/Button';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Loading } from '../../ui/components/Loading';
import { templatesKey } from './queries';
import { TemplateForm } from './TemplateForm';

export function TemplateEditor({ id }: { id?: number }) {
  const { api } = useSession();
  const router = useRouter();
  const query = useQuery({
    queryKey: [...templatesKey, id],
    queryFn: () => api.getWorkoutTemplate(id!),
    enabled: id !== undefined && Number.isSafeInteger(id) && id > 0,
  });

  if (id !== undefined) {
    if (!Number.isSafeInteger(id) || id <= 0)
      return (
        <Page>
          <Heading>Template not found</Heading>
          <Button title="Back to templates" onPress={() => router.replace('/templates')} />
        </Page>
      );
    if (query.isPending) return <Loading text="Loading template…" />;
    if (query.isError)
      return (
        <Page>
          <ErrorNotice message={errorMessage(query.error)} />
          <Button
            title="Try again"
            onPress={() => {
              void query.refetch();
            }}
          />
          <Button title="Back to templates" onPress={() => router.replace('/templates')} />
        </Page>
      );

    return <TemplateForm key={id} template={query.data} />;
  }

  return <TemplateForm />;
}
