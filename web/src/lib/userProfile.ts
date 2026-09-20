const KEY = "bazaar.userProfile.";

export type UserProfile = {
  name: string;
  avatar: string;
  banner: string;
  website: string;
  twitter: string;
  discord: string;
};

export const emptyProfile = (): UserProfile => ({
  name: "",
  avatar: "",
  banner: "",
  website: "",
  twitter: "",
  discord: "",
});

export function loadLocalProfile(addr: string): UserProfile {
  try {
    const raw = localStorage.getItem(KEY + addr.toLowerCase());
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: String(p.name || "").trim(),
      avatar: String(p.avatar || "").trim(),
      banner: String(p.banner || "").trim(),
      website: String(p.website || "").trim(),
      twitter: String(p.twitter || "").trim(),
      discord: String(p.discord || "").trim(),
    };
  } catch {
    return emptyProfile();
  }
}

export function saveLocalProfile(addr: string, p: UserProfile) {
  localStorage.setItem(KEY + addr.toLowerCase(), JSON.stringify(p));
}

export function parseProfileLine(raw: string): UserProfile {
  const text = raw.replace(/^\("/, "").replace(/"\s*string\)\s*$/, "").replace(/^"|"$/g, "");
  const parts = text.split("|");
  if (parts.length < 2 && !text.includes("|")) return emptyProfile();
  return {
    name: (parts[0] || "").trim(),
    avatar: (parts[1] || "").trim(),
    banner: (parts[2] || "").trim(),
    website: (parts[3] || "").trim(),
    twitter: (parts[4] || "").trim(),
    discord: (parts[5] || "").trim(),
  };
}
