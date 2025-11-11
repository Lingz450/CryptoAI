import { Navbar } from '@/components/Navbar';
import { CommandPalette } from '@/components/CommandPalette';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <CommandPalette />
      {children}
    </>
  );
}

