'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import SignInModal from './SignInModal';

interface SignInModalContextType {
  showSignInModal: (message?: string) => void;
  hideSignInModal: () => void;
}

const SignInModalContext = createContext<SignInModalContextType | undefined>(undefined);

export function SignInModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string>('');

  const showSignInModal = (customMessage?: string) => {
    setMessage(customMessage || 'Please sign in to continue');
    setIsOpen(true);
  };

  const hideSignInModal = () => {
    setIsOpen(false);
    setMessage('');
  };

  return (
    <SignInModalContext.Provider value={{ showSignInModal, hideSignInModal }}>
      {children}
      <SignInModal isOpen={isOpen} onClose={hideSignInModal} message={message} />
    </SignInModalContext.Provider>
  );
}

export function useSignInModal() {
  const context = useContext(SignInModalContext);
  if (context === undefined) {
    throw new Error('useSignInModal must be used within a SignInModalProvider');
  }
  return context;
}
