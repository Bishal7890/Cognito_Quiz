// components/Header.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  bubble: {
    backgroundColor: "#bda2ff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  subtitle: { color: "#5b2fa6", marginTop: 8, fontWeight: "600" },
});
