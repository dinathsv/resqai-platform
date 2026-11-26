import { createContext, useContext } from 'react';

export type GuestStatus = 'pending' | 'approved' | 'rejected' | 'unavailable' | 'expired';

export const PeopleAccessContext = createContext<{ canUseRequests: boolean; guestStatus: GuestStatus | null }>({
  canUseRequests: false,
  guestStatus: null,
});

export function usePeopleAccess() {
  return useContext(PeopleAccessContext);
}
