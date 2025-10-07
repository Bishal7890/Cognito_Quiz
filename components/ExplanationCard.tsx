// components/ExplanationCard.tsx
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

/**
 * ExplanationCard props:
 * - question: string
 * - answer: string
 * - visible: boolean (set true when you want to fetch/show explanation)
 * - onNext: () => void (called when user taps Next)
 */
export default function ExplanationCard({
  question,
  answer,
  visible,
  onNext,
}: {
  question: string;
  answer: string;
  visible: boolean;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [shortText, setShortText] = useState<string | null>(null);
  const [readMoreUrl, setReadMoreUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchAndPrepare() {
      if (!visible) return;
      setLoading(true);
      setFullText(null);
      setShortText(null);
      setReadMoreUrl(null);

      try {
        const res = await fetchExplanation(question, answer);

        if (!active) return;

        const text = (res.text || "").trim();
        const readMore = res.readMore || null;
        setFullText(text || "No detailed explanation found.");
        setReadMoreUrl(readMore);

        // Create a short contextual snippet (prefer first 2-3 sentences)
        const snippet = makeSnippet(text, 3, 350);
        setShortText(snippet);
      } catch (e) {
        console.warn("explain err", e);
        if (!active) return;
        setFullText("Failed to fetch an explanation. Please try again.");
        setShortText("Failed to fetch an explanation. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAndPrepare();
    return () => {
      active = false;
    };
  }, [visible, question, answer]);

  const handleReadMore = () => {
    if (readMoreUrl) Linking.openURL(readMoreUrl);
    else if (fullText) setShowModal(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Explanation</Text>

      <View style={styles.contentWrap}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={true}>
            <Text style={styles.explanationText}>
              {shortText ?? "No explanation available."}
            </Text>
            {fullText && shortText && fullText.length > shortText.length ? (
              <Text style={styles.continued}>Tap "Read more" to see full details</Text>
            ) : null}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.readBtn} onPress={handleReadMore}>
          <Text style={styles.readBtnText}>Read more</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextBtnText}>Next</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalWrap}>
          <Text style={styles.modalHeading}>Full Explanation</Text>
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.modalText}>{fullText}</Text>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            {readMoreUrl ? (
              <TouchableOpacity style={styles.modalOpen} onPress={() => Linking.openURL(readMoreUrl)}>
                <Text style={styles.modalOpenText}>Open Source</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ----------------------
  Explanation fetch helper: DuckDuckGo -> Wikipedia -> fallback
------------------------*/

async function fetchExplanation(question: string, answer: string) {
  const q = encodeURIComponent(`${question} ${answer}`);

  // 1) DuckDuckGo Instant Answer
  try {
    const ddResp = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`);
    const dd = await ddResp.json();
    if (dd?.AbstractText && dd.AbstractText.length > 40) {
      return { text: dd.AbstractText, readMore: dd.AbstractURL || `https://duckduckgo.com/?q=${q}` };
    }
  } catch (e) {
    // fallback
  }

  // 2) Wikipedia search + summary
  try {
    const sResp = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&utf8=&format=json&origin=*`
    );
    const sJson = await sResp.json();
    const hits = sJson?.query?.search;
    if (Array.isArray(hits) && hits.length > 0) {
      const title = encodeURIComponent(hits[0].title);
      const summaryResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
      const summaryJson = await summaryResp.json();
      const text = summaryJson?.extract || summaryJson?.extract_html || "";
      const readMore = summaryJson?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`;
      if (text && text.length > 30) return { text, readMore };
    }
  } catch (e) {
    // fallback
  }

  // 3) fallback: search link
  return {
    text:
      "No concise explanation found automatically. Tap Read more to search the web for authoritative context about this question and answer.",
    readMore: `https://www.google.com/search?q=${q}`,
  };
}

function makeSnippet(text: string, maxSentences = 2, maxChars = 400) {
  if (!text) return "";
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
  let snippet = sentences.slice(0, maxSentences).join(" ").trim();
  if (snippet.length > maxChars) snippet = snippet.slice(0, maxChars).trim() + "…";
  if (snippet.length < 80 && text.length > snippet.length) {
    snippet = text.slice(0, Math.min(maxChars, text.length)).trim() + (text.length > maxChars ? "…" : "");
  }
  return snippet;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heading: { fontWeight: "700", color: "#6a3fbf", marginBottom: 8, fontSize: 15 },

  contentWrap: {
    maxHeight: 180,
    minHeight: 110,
    marginBottom: 10,
  },
  scroll: { paddingRight: 6 },
  explanationText: { color: "#333", lineHeight: 20, fontSize: 14 },
  continued: { marginTop: 8, fontSize: 12, color: "#7b4cff" },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  readBtn: {
    backgroundColor: "#efe6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  readBtnText: { color: "#6a3fbf", fontWeight: "700" },

  nextBtn: {
    backgroundColor: "#8a4bff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  nextBtnText: { color: "white", fontWeight: "800" },

  modalWrap: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: "#fff" },
  modalHeading: { fontWeight: "800", fontSize: 18, marginBottom: 12, color: "#5b2fa6" },
  modalScroll: { flex: 1 },
  modalText: { color: "#333", lineHeight: 20, fontSize: 15 },
  modalFooter: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  modalClose: { backgroundColor: "#efe6ff", padding: 12, borderRadius: 8 },
  modalCloseText: { color: "#6a3fbf", fontWeight: "700" },
  modalOpen: { backgroundColor: "#8a4bff", padding: 12, borderRadius: 8 },
  modalOpenText: { color: "#fff", fontWeight: "700" },
});
