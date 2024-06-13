"use client";
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchObject } from "@/lib/types";
import { ChainCombobox } from "./ChainCombobox";
import { IconCirclesRelation, IconLoader2 } from "@tabler/icons-react";

interface SearchFormProps {
  formValues: SearchObject;
  setFormValues: (formValues: SearchObject) => void;
  findConnections: () => void;
  loading: boolean;
}

export function SearchForm({ formValues, setFormValues, findConnections, loading }: SearchFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  const handleChainChange = (value: string) => {
    setFormValues({
      ...formValues,
      chain: value,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    findConnections();
  };

  return (
    <form className="my-8 w-full" onSubmit={handleSubmit}>
      <LabelInputContainer className="mb-4">
        <Label htmlFor="senderAddress">Sender Address</Label>
        <Input id="senderAddress" name="senderAddress" placeholder="0x12...45" type="text" value={formValues.senderAddress} onChange={handleChange} />
      </LabelInputContainer>

      <LabelInputContainer className="mb-4">
        <Label htmlFor="receiverAddress">Receiver Address</Label>
        <Input id="receiverAddress" name="receiverAddress" placeholder="0x67...89" type="text" value={formValues.receiverAddress} onChange={handleChange} />
      </LabelInputContainer>

      <LabelInputContainer className="w-full mb-4">
        <Label htmlFor="chain">Chain</Label>
        <ChainCombobox value={formValues.chain} onChange={handleChainChange} />
      </LabelInputContainer>

      <div className="bg-gradient-to-r from-transparent via-neutral-300 dark:via-neutral-700 to-transparent my-8 h-[1px] w-full" />

      <div className="flex flex-col space-y-4">
        <button className="bg-gradient-to-br relative group/btn from-black dark:from-zinc-900 dark:to-zinc-900 to-neutral-600 flex items-center justify-center dark:bg-zinc-800 w-full text-white rounded-md h-10 font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]" type="submit" disabled={loading}>
          Find Connections
          <span className="ml-1.5">{loading ? <IconLoader2 className="animate-spin w-5 h-5" /> : <IconCirclesRelation className="animate-pulse duration-10000 w-5 h-5" />}</span>
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
