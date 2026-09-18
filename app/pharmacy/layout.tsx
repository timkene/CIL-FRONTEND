import { PharmacySessionBar } from '@/components/pharmacy/PharmacySessionBar'

// proxy.ts verifies backend staff identity before serving any operational Pharmacy page.
export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  return <><PharmacySessionBar />{children}</>
}
