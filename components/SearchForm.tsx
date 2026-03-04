"use client";
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchObject, isValidEthAddress, isValidSolanaAddress, isValidAddress } from "@/lib/types";
import { ChainCombobox } from "./ChainCombobox";
import { IconCirclesRelation, IconLoader2, IconInfoCircle, IconLock } from "@tabler/icons-react";

const MAX_RANGE_DAYS = 7;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function dateDiffDays(from: string, till: string): number {
  const f = new Date(from);
  const t = new Date(till);
  return Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}

interface SearchFormProps {
  formValues: SearchObject;
  setFormValues: React.Dispatch<React.SetStateAction<SearchObject>>;
  findConnections: () => void;
  loading: boolean;
}

interface FormErrors {
  senderAddress?: string;
  receiverAddress?: string;
  fromDate?: string;
  tillDate?: string;
}

export function SearchForm({ formValues, setFormValues, findConnections, loading }: SearchFormProps) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isSolana = formValues.chain === "solana";
  const isSingleAddress = !formValues.receiverAddress.trim();

  // Auto-detect chain from address and return the detected chain (or null)
  const detectChain = (address: string): string | null => {
    if (isValidEthAddress(address)) return "ethereum";
    if (isValidSolanaAddress(address)) return "solana";
    return null;
  };

  // Force depth=1 when in single-address mode
  useEffect(() => {
    if (isSingleAddress && formValues.depth !== 1) {
      setFormValues((prev) => ({ ...prev, depth: 1 }));
    }
  }, [isSingleAddress, formValues.depth, setFormValues]);

  // When switching chains, clear errors and touched state
  useEffect(() => {
    setErrors({});
    setTouched({});
  }, [formValues.chain]);

  // Set default dates for Solana when chain is switched
  useEffect(() => {
    if (!isSolana) return;
    const today = todayStr();
    setFormValues((prev) => {
      if (prev.fromDate) return prev;
      return {
        ...prev,
        fromDate: addDays(today, -MAX_RANGE_DAYS),
        tillDate: today,
      };
    });
  }, [isSolana, setFormValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Auto-detect chain from address input
    if ((name === "senderAddress" || name === "receiverAddress") && value) {
      const detected = detectChain(value);
      if (detected && detected !== formValues.chain) {
        // Auto-switch chain, clear the OTHER address (keep current one), reset dates
        const otherField = name === "senderAddress" ? "receiverAddress" : "senderAddress";
        setFormValues({
          ...formValues,
          chain: detected,
          [name]: value,
          [otherField]: "",
          fromDate: undefined,
          tillDate: undefined,
        });
        setErrors({});
        setTouched({});
        return;
      }
    }

    // Auto-clamp date ranges for Solana
    if (isSolana && name === "fromDate" && value) {
      const today = todayStr();
      const maxTill = addDays(value, MAX_RANGE_DAYS);
      const clampedTill = maxTill > today ? today : maxTill;
      // If current till is beyond max range, auto-adjust
      const currentTill = formValues.tillDate || today;
      const newTill = currentTill > clampedTill ? clampedTill : (currentTill < value ? addDays(value, 7) > today ? today : addDays(value, 7) : currentTill);
      setFormValues({ ...formValues, fromDate: value, tillDate: newTill });
      if (errors.fromDate || errors.tillDate) {
        setErrors((prev) => ({ ...prev, fromDate: undefined, tillDate: undefined }));
      }
      return;
    }

    if (isSolana && name === "tillDate" && value) {
      const minFrom = addDays(value, -MAX_RANGE_DAYS);
      const currentFrom = formValues.fromDate || minFrom;
      const newFrom = currentFrom < minFrom ? minFrom : currentFrom;
      setFormValues({ ...formValues, tillDate: value, fromDate: newFrom });
      if (errors.fromDate || errors.tillDate) {
        setErrors((prev) => ({ ...prev, fromDate: undefined, tillDate: undefined }));
      }
      return;
    }

    setFormValues({
      ...formValues,
      [name]: value,
    });

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    if (name === "senderAddress" && value && !isValidAddress(value, formValues.chain)) {
      setErrors((prev) => ({
        ...prev,
        senderAddress: isSolana
          ? "Invalid Solana address. Must be 32-44 base58 characters."
          : "Invalid Ethereum address. Must start with 0x followed by 40 hex characters.",
      }));
    }

    if (name === "receiverAddress" && value && !isValidAddress(value, formValues.chain)) {
      setErrors((prev) => ({
        ...prev,
        receiverAddress: isSolana
          ? "Invalid Solana address. Must be 32-44 base58 characters."
          : "Invalid Ethereum address. Must start with 0x followed by 40 hex characters.",
      }));
    }
  };

  const handleChainChange = (value: string) => {
    setFormValues({
      ...formValues,
      chain: value,
      senderAddress: "",
      receiverAddress: "",
      fromDate: undefined,
      tillDate: undefined,
    });
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formValues.senderAddress.trim()) {
      newErrors.senderAddress = isSolana ? "Center address is required." : "Sender address is required.";
    } else if (!isValidAddress(formValues.senderAddress, formValues.chain)) {
      newErrors.senderAddress = isSolana
        ? "Invalid Solana address format."
        : "Invalid Ethereum address format.";
    }

    if (isSolana) {
      if (formValues.receiverAddress.trim() && !isValidSolanaAddress(formValues.receiverAddress)) {
        newErrors.receiverAddress = "Invalid Solana address format.";
      }
      if (
        formValues.senderAddress &&
        formValues.receiverAddress.trim() &&
        formValues.senderAddress === formValues.receiverAddress
      ) {
        newErrors.receiverAddress = "Addresses must be different.";
      }
      if (!formValues.fromDate) {
        newErrors.fromDate = "Start date is required.";
      }
      if (!formValues.tillDate) {
        newErrors.tillDate = "End date is required.";
      }
      if (formValues.fromDate && formValues.tillDate) {
        if (formValues.fromDate > formValues.tillDate) {
          newErrors.tillDate = "End date must be after start date.";
        }
        const diff = dateDiffDays(formValues.fromDate, formValues.tillDate);
        if (diff > MAX_RANGE_DAYS) {
          newErrors.tillDate = `Max ${MAX_RANGE_DAYS} days per query. Use "Load Previous Period" for longer ranges.`;
        }
      }
    } else {
      // ETH: receiver is optional (single-address mode if empty)
      if (formValues.receiverAddress.trim() && !isValidEthAddress(formValues.receiverAddress)) {
        newErrors.receiverAddress = "Invalid Ethereum address format.";
      }

      if (
        formValues.senderAddress &&
        formValues.receiverAddress.trim() &&
        formValues.senderAddress.toLowerCase() === formValues.receiverAddress.toLowerCase()
      ) {
        newErrors.receiverAddress = "Addresses must be different.";
      }
    }

    setErrors(newErrors);
    setTouched({ senderAddress: true, receiverAddress: true, fromDate: true, tillDate: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate()) {
      findConnections();
    }
  };

  const isFormValid = (() => {
    const senderOk = isValidAddress(formValues.senderAddress, formValues.chain);

    if (isSolana) {
      const finalOk = !formValues.receiverAddress.trim() || isValidSolanaAddress(formValues.receiverAddress);
      const notSame = !formValues.receiverAddress.trim() || formValues.senderAddress !== formValues.receiverAddress;
      const datesOk = !!formValues.fromDate && !!formValues.tillDate
        && formValues.fromDate <= formValues.tillDate
        && dateDiffDays(formValues.fromDate, formValues.tillDate) <= MAX_RANGE_DAYS;
      return senderOk && finalOk && notSame && datesOk;
    }

    // ETH: receiver is optional; if provided it must be valid and different
    const receiverOk = !formValues.receiverAddress.trim() || isValidEthAddress(formValues.receiverAddress);
    const notSame = !formValues.receiverAddress.trim() || formValues.senderAddress.toLowerCase() !== formValues.receiverAddress.toLowerCase();
    return senderOk && receiverOk && notSame;
  })();

  return (
    <form className="my-8 w-full" onSubmit={handleSubmit}>
      <LabelInputContainer className="mb-4">
        <Label htmlFor="senderAddress">
          {isSolana ? "Center Address" : "Sender Address"}
        </Label>
        <Input
          id="senderAddress"
          name="senderAddress"
          placeholder={isSolana ? "CrJao7TGH...K9pU7ybgSSK4DNvLpC" : "0x1234...abcd"}
          type="text"
          value={formValues.senderAddress}
          onChange={handleChange}
          onBlur={handleBlur}
          className={touched.senderAddress && errors.senderAddress ? "border-red-500 dark:border-red-500" : ""}
        />
        {touched.senderAddress && errors.senderAddress && (
          <p className="text-xs text-red-400 mt-1">{errors.senderAddress}</p>
        )}
      </LabelInputContainer>

      <LabelInputContainer className="mb-4">
        <Label htmlFor="receiverAddress">
          {isSolana ? (
            <>
              Final Address
              <span className="text-xs text-neutral-500 font-normal ml-2">(Optional)</span>
            </>
          ) : (
            <>
              Receiver Address
              <span className="text-xs text-neutral-500 font-normal ml-2">(Optional — leave empty to explore all connections)</span>
            </>
          )}
        </Label>
        <Input
          id="receiverAddress"
          name="receiverAddress"
          placeholder={isSolana ? "Optional: track if funds reach this address" : "Optional: 0x5678...efgh"}
          type="text"
          value={formValues.receiverAddress}
          onChange={handleChange}
          onBlur={handleBlur}
          className={touched.receiverAddress && errors.receiverAddress ? "border-red-500 dark:border-red-500" : ""}
        />
        {touched.receiverAddress && errors.receiverAddress && (
          <p className="text-xs text-red-400 mt-1">{errors.receiverAddress}</p>
        )}
      </LabelInputContainer>

      <LabelInputContainer className="w-full mb-4">
        <Label htmlFor="chain">Chain</Label>
        <ChainCombobox value={formValues.chain} onChange={handleChainChange} />
      </LabelInputContainer>

      {/* Solana date range inputs */}
      {isSolana && (
        <>
          <div className="flex items-center gap-1.5 mb-2">
            <IconInfoCircle className="w-3.5 h-3.5 text-cyan-500/70" />
            <span className="text-xs text-cyan-500/70">Max {MAX_RANGE_DAYS} days per query - use &quot;Load Previous Period&quot; for longer ranges</span>
          </div>
          <div className="flex gap-3 mb-4">
            <LabelInputContainer className="flex-1">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                name="fromDate"
                type="date"
                value={formValues.fromDate || ""}
                onChange={handleChange}
                className={cn(
                  "text-sm",
                  touched.fromDate && errors.fromDate ? "border-red-500 dark:border-red-500" : ""
                )}
              />
              {touched.fromDate && errors.fromDate && (
                <p className="text-xs text-red-400 mt-1">{errors.fromDate}</p>
              )}
            </LabelInputContainer>
            <LabelInputContainer className="flex-1">
              <Label htmlFor="tillDate">Till</Label>
              <Input
                id="tillDate"
                name="tillDate"
                type="date"
                value={formValues.tillDate || ""}
                onChange={handleChange}
                className={cn(
                  "text-sm",
                  touched.tillDate && errors.tillDate ? "border-red-500 dark:border-red-500" : ""
                )}
              />
              {touched.tillDate && errors.tillDate && (
                <p className="text-xs text-red-400 mt-1">{errors.tillDate}</p>
              )}
            </LabelInputContainer>
          </div>
        </>
      )}

      <LabelInputContainer className="w-full mb-4">
        <Label htmlFor="depth">
          <span className="flex items-center gap-1.5">
            Search Depth: {formValues.depth === 1 ? 'Direct Only' : '1-Hop'}
            {isSingleAddress && (
              <IconLock className="w-3.5 h-3.5 text-neutral-500" />
            )}
          </span>
        </Label>
        <input
          id="depth"
          type="range"
          min="1"
          max="2"
          step="1"
          value={formValues.depth}
          onChange={(e) => setFormValues({ ...formValues, depth: Number(e.target.value) })}
          disabled={isSingleAddress}
          className={cn(
            "w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none accent-cyan-500",
            isSingleAddress ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
          )}
        />
        <div className="flex justify-between w-full text-xs text-neutral-500 px-1 mt-1">
          <span>Direct Only (0-Hop)</span>
          <span>1-Hop (via intermediary)</span>
        </div>
        <p className="text-[10px] text-neutral-600 mt-1">
          {isSingleAddress
            ? 'Hop search requires two addresses. Add a receiver to unlock 1-Hop.'
            : formValues.depth === 1
              ? 'Shows only direct transfers between sender and receiver.'
              : 'Searches top 50 connections per address to find shared intermediaries.'}
        </p>
      </LabelInputContainer>

      <div className="bg-gradient-to-r from-transparent via-neutral-300 dark:via-neutral-700 to-transparent my-8 h-[1px] w-full" />

      <div className="flex flex-col space-y-4">
        <button
          className={cn(
            "bg-gradient-to-br relative group/btn from-black dark:from-zinc-900 dark:to-zinc-900 to-neutral-600 flex items-center justify-center dark:bg-zinc-800 w-full text-white rounded-md h-10 font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]",
            (!isFormValid || loading) && "opacity-50 cursor-not-allowed"
          )}
          type="submit"
          disabled={loading || !isFormValid}
        >
          {loading ? "Searching..." : "Find Connections"}
          <span className="ml-1.5">
            {loading ? (
              <IconLoader2 className="animate-spin w-5 h-5" />
            ) : (
              <IconCirclesRelation className="animate-pulse duration-10000 w-5 h-5" />
            )}
          </span>
          <BottomGradient />
        </button>
      </div>
    </form>
  );
}

const BottomGradient = () => {
  return (
    <>
      <span className="group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
    </>
  );
};

const LabelInputContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn("flex flex-col space-y-2 w-full", className)}>{children}</div>;
};
