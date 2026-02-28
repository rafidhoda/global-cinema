"use client";

import { useState } from "react";
import Image from "next/image";

const TUTORIAL_STORAGE_KEY = "global-cinema-wormhole-tutorial-done";

export function getTutorialDone(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
}

export function setTutorialDone(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
}

type TutorialStrings = {
  tutorialTitle: string;
  tutorialStep1: string;
  tutorialStep2: string;
  tutorialStep3: string;
  tutorialStep4WithLang: (lang: string) => string;
  tutorialNext: string;
  tutorialDownloaded: string;
  tutorialLocateFile: string;
  tutorialSkip: string;
};

type Props = {
  strings: TutorialStrings;
  subtitleLanguageLabel: string;
  onLocateFile: () => void;
  onSkip: () => void;
};

const WORMHOLE_MOVIE_URL = "https://wormhole.app/o43Zp9#LDulBYrW_5f1sYvKfqfHHA";

const IMAGES = [
  "/tutorial/wormhole-step1.png",
  "/tutorial/wormhole-step2.png",
  "/tutorial/wormhole-step3.png",
] as const;

export function WormholeTutorial({
  strings,
  subtitleLanguageLabel,
  onLocateFile,
  onSkip,
}: Props) {
  const [step, setStep] = useState(1);

  const handleLocateFile = () => {
    setTutorialDone();
    onLocateFile();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setTutorialDone();
            onSkip();
          }}
          className="absolute right-3 top-3 z-10 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          {strings.tutorialSkip}
        </button>

        <div className="border-b border-zinc-700 px-6 py-4 text-center">
          <h2 className="text-xl font-bold text-white">
            {strings.tutorialTitle}
          </h2>
          <div className="mt-2 flex justify-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full ${
                  s === step ? "bg-white" : "bg-zinc-600"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {step <= 3 && (
            <div className="relative mb-4 min-h-[320px] w-full overflow-hidden rounded-lg bg-zinc-800 sm:min-h-[420px] lg:min-h-[500px]">
              <Image
                src={IMAGES[step - 1]}
                alt=""
                fill
                className="object-contain"
                sizes="(max-width: 896px) 100vw, 896px"
                unoptimized
              />
            </div>
          )}

          <div className="mb-6 text-center">
            <p className="text-zinc-200">
              {step === 1 && strings.tutorialStep1}
              {step === 2 && strings.tutorialStep2}
              {step === 3 && strings.tutorialStep3}
              {step === 4 &&
                strings.tutorialStep4WithLang(subtitleLanguageLabel)}
            </p>
            {step === 1 && (
              <a
                href={WORMHOLE_MOVIE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block break-all rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 sm:text-base"
              >
                {WORMHOLE_MOVIE_URL}
              </a>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            {step < 4 ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="w-full rounded-xl bg-white px-6 py-4 text-lg font-bold text-black transition hover:bg-zinc-100"
                >
                  {step === 3 ? strings.tutorialDownloaded : strings.tutorialNext}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleLocateFile}
                className="w-full rounded-xl bg-white px-6 py-4 text-lg font-bold text-black transition hover:bg-zinc-100"
              >
                {strings.tutorialLocateFile}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
