// components/OptionRow.tsx
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  state?: "normal" | "selected" | "correct" | "wrong";
};

export default function OptionRow({ label, onPress, disabled, state = "normal" }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "selected") {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  const background =
    state === "correct"
      ? styles.correct
      : state === "wrong"
      ? styles.wrong
      : state === "selected"
      ? styles.selected
      : styles.normal;

  // label text color (option text)
  const labelTextStyle =
    state === "correct" || state === "wrong" ? styles.whiteText : styles.optionText;

  // letter (A/B/C) text color: keep visible when option bg is colored.
  // For colored option (green/red), we keep the circle white and letter dark.
  const letterTextStyle =
    state === "correct" || state === "wrong" ? styles.letterDarkText : styles.letterDefaultText;

  const handlePress = () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {
      // ignore
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginVertical: 8 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={disabled}
        style={[styles.row, background]}
      >
        <View style={[styles.letter, (state === "correct" || state === "wrong") && styles.letterOnColored]}>
          <Text style={letterTextStyle}>{label.slice(0, 1)}</Text>
        </View>
        <Text style={[styles.label, labelTextStyle]}>{label.slice(3)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 999,
    paddingHorizontal: 18,
    marginHorizontal: 2,
  },
  normal: { backgroundColor: "#efe6ff" },
  selected: { backgroundColor: "#efe1ff", borderWidth: 2, borderColor: "#8a4bff" },

  // correct / wrong option background
  correct: { backgroundColor: "#28a745" },
  wrong: { backgroundColor: "#ff6b6b" },

  // letter circle
  letter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "#ffffff",
    elevation: 1,
  },

  // when option has colored background, keep letter circle white (already default)
  letterOnColored: {
    backgroundColor: "#ffffff",
  },

  // text styles
  label: { fontWeight: "600", fontSize: 16, flex: 1 },
  optionText: { color: "#2c1546" },
  whiteText: { color: "#fff" },

  // letter text colors
  letterDefaultText: { color: "#2c1546", fontWeight: "700" },
  letterDarkText: { color: "#2c1546", fontWeight: "700" },
});
