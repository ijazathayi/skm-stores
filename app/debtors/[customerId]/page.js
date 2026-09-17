import DebtorsApp from '@/components/DebtorsApp';

export default async function DebtorAccountPage({ params }) {
  const { customerId } = await params;
  return <DebtorsApp customerId={customerId} />;
}