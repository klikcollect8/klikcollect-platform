"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

/** Redirects to Clerk sign-in — no Supabase Auth. */
export default function SignInModal({ isOpen, onClose, message }: SignInModalProps) {
  const router = useRouter();
  if (!isOpen) return null;

  const goSignIn = () => {
    onClose();
    router.push("/sign-in");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Sign in required</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
        <p className="text-sm text-gray-500 mb-6">
          Use your KlikCollect account to continue.
        </p>
        <button
          type="button"
          onClick={goSignIn}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push("/sign-up");
          }}
          className="w-full mt-3 text-indigo-600 text-sm font-medium"
        >
          Create an account
        </button>
      </div>
    </div>
  );
}
