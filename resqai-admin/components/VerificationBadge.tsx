import { readable } from '@/lib/operations';

export default function VerificationBadge({ status = 'unverified' }: { status?: string }) {
  return <span className={`statusBadge ${status === 'verified' ? 'statusSuccess' : status === 'rejected' ? 'statusCritical' : 'statusWarning'}`}>
    {status === 'verified' ? 'Need confirmed' : readable(status)}
  </span>;
}
