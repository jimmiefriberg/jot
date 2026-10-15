// The GitHub emoji shortcode list that ships with markdown-it-emoji: shortcode name → emoji.
declare module 'markdown-it-emoji/lib/data/full.mjs' {
  const emojiByName: Record<string, string>;
  export default emojiByName;
}
