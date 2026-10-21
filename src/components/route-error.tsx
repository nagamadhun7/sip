import React, { useEffect } from "react";
import { reportCrash } from "../lib/crashes";
import { router } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { Page, T, Button } from "./ui";
export function ErrorBoundary({ retry, error }: ErrorBoundaryProps) {
  useEffect(() => {
    reportCrash(error);
  }, [error]);
  return (
    <Page>
      <T bold size={24}>
        Could not open this screen
      </T>
      <T>Your saved drinks have not been erased. Retry, or return to Today.</T>
      <Button title="Try again" onPress={() => void retry()} />
      <Button
        secondary
        title="Go to Today"
        onPress={() => router.replace("/")}
      />
    </Page>
  );
}
