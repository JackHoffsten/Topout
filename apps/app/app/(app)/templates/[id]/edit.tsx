import { useLocalSearchParams } from 'expo-router';
import { TemplateEditor } from '../../../../src/features/templates/TemplateEditor';

export default function EditTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TemplateEditor id={Number(id)} />;
}
