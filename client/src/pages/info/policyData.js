/** Icon, colour tone and one-line summary for each policy page. */
export const POL_META = {
  privacy: { icon: '🔒', tone: 250, line: 'How we collect, use and protect your information.' },
  terms: { icon: '📜', tone: 290, line: 'The rules that apply when you shop with AR Trade.' },
  returns: { icon: '↺', tone: 150, line: 'Easy returns, free replacement for faulty items and quick refunds.' },
  shipping: { icon: '🚚', tone: 40, line: 'Where we deliver, how fast and what it costs.' }
};
// What the website chat and visit tracking keep. It is added to the privacy page here (not typed into the editable policy text)
// so it always shows, whatever the editors save.
export const CHAT_DATA_SECTION = {
  h: 'Chat and visit information',
  p: 'When you start a chat with us we keep your name, mobile number, whether you use us personally, for an office or as a reseller, and the location you give us. We also record technical details of your visit: your device type, operating system and browser, your IP address (and the approximate place it points to), screen size, language, time zone, the page you started on, where you came from and any campaign tag in the link you used. If your browser asks to share your exact location and you allow it, we keep that position too; if you decline, the chat works exactly the same. We use this to answer you, plan delivery, let our sellers follow up on your enquiry and improve our service. We use your contact details for offers only if you tick the offers box, and you can ask us to stop at any time. We do not sell this information, and only AR Trade staff can see it. To have your chat record deleted, call or WhatsApp us. (বাংলায়: চ্যাট শুরু করলে আপনার নাম, মোবাইল নম্বর, ডিভাইস, ব্রাউজার, IP ঠিকানা ও আপনি অনুমতি দিলে সঠিক লোকেশন আমরা সংরক্ষণ করি। এগুলো বিক্রি করা হয় না।)'
};
// pulls a short "key fact" (e.g. "7 days", "48 hours") out of a section so it can be shown as a badge
export const FACT = /(\d+(?:\s*[–-]\s*\d+)?\s*(?:working\s+days?|days?|hours?|hrs?|minutes?))/i;
