import { createFileRoute } from '@tanstack/react-router';
import { StagePlaceholder } from '../../features/shell/StagePlaceholder';

export const Route = createFileRoute('/_app/')({
  component: () => <StagePlaceholder page="dashboard" />,
});
