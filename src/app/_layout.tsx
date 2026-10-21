import "../lib/crashes";
import { ServiceNotice } from "../components/service-notice";
import { AccessiblePressable as Pressable } from "../components/accessible-pressable";
import { NotificationActions } from "../components/notification-actions";
import React from "react";
import { router } from "expo-router";
import { T } from "../components/ui";
import { Stack } from "expo-router/stack";
import { useFonts } from "expo-font";
import { Nunito_400Regular } from "@expo-google-fonts/nunito/400Regular";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "../state/store";
function MakerBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    >
      <T size={28} style={{ color: "#103B62" }}>
        ‹
      </T>
    </Pressable>
  );
}
export default function Layout() {
  const [fonts, error] = useFonts({ Nunito_400Regular, Nunito_600SemiBold });
  if (!fonts && !error) return null;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <NotificationActions />
        <ServiceNotice />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: "white" },
            headerShadowVisible: false,
            headerTitleStyle: {
              fontFamily: "Nunito_600SemiBold",
              color: "#1F2A33",
            },
            headerTintColor: "#596875",
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="week" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="add"
            options={{ title: "Add a drink", presentation: "modal" }}
          />
          <Stack.Screen
            name="drink-maker"
            options={{ title: "Drink maker", headerLeft: () => <MakerBack /> }}
          />
          <Stack.Screen
            name="my-drinks"
            options={{ title: "My drinks", headerLeft: () => <MakerBack /> }}
          />
          <Stack.Screen
            name="maker-profile"
            options={{
              title: "Recipe profile",
              headerLeft: () => <MakerBack />,
            }}
          />
          <Stack.Screen
            name="pro"
            options={{ title: "Sip Pro", headerLeft: () => <MakerBack /> }}
          />
          <Stack.Screen name="drink" options={{ title: "Drink" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen
            name="targets"
            options={{ title: "Your daily targets" }}
          />
          <Stack.Screen name="scan" options={{ title: "Barcode" }} />
          <Stack.Screen name="balance" options={{ title: "Balance" }} />
          <Stack.Screen name="caffeine" options={{ title: "Caffeine" }} />
          <Stack.Screen name="privacy" options={{ title: "Your data" }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export { ErrorBoundary } from "../components/route-error";
