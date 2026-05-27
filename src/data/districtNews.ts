// Content lives in /src/data/news/*.json — DO NOT hardcode news arrays here.
// Edit news daily by updating the JSON files only.
import coimbatore from "@/data/news/coimbatore.json";
import dharmapuri from "@/data/news/dharmapuri.json";
import erode from "@/data/news/erode.json";
import karur from "@/data/news/karur.json";
import namakkal from "@/data/news/namakkal.json";
import nilgiris from "@/data/news/nilgiris.json";
import salem from "@/data/news/salem.json";
import tiruppur from "@/data/news/tiruppur.json";

export interface DistrictNewsItem {
  id: string;
  title: string;
  title_ta?: string;
  summary: string;
  summary_ta?: string;
  category: "Election" | "Campaign" | "Awareness" | "Enforcement" | string;
  date: string;
  featured?: boolean;
  image?: string;
  link?: string;   // original article URL — set by fetch-news script
}

export const districtNews: Record<string, DistrictNewsItem[]> = {
  coimbatore: coimbatore as DistrictNewsItem[],
  dharmapuri: dharmapuri as DistrictNewsItem[],
  erode: erode as DistrictNewsItem[],
  karur: karur as DistrictNewsItem[],
  namakkal: namakkal as DistrictNewsItem[],
  nilgiris: nilgiris as DistrictNewsItem[],
  salem: salem as DistrictNewsItem[],
  tiruppur: tiruppur as DistrictNewsItem[],
};

export const districtMeta: Record<string, { name: string; tagline: string }> = {
  coimbatore: { name: "Coimbatore", tagline: "10 constituencies • Polling: April 23, 2026" },
  erode: { name: "Erode", tagline: "8 constituencies • Polling: April 23, 2026" },
  tiruppur: { name: "Tiruppur", tagline: "8 constituencies • Polling: April 23, 2026" },
  salem: { name: "Salem", tagline: "11 constituencies • Polling: April 23, 2026" },
  namakkal: { name: "Namakkal", tagline: "6 constituencies • Polling: April 23, 2026" },
  nilgiris: { name: "Nilgiris", tagline: "3 constituencies • Polling: April 23, 2026" },
  karur: { name: "Karur", tagline: "4 constituencies • Polling: April 23, 2026" },
  dharmapuri: { name: "Dharmapuri", tagline: "5 constituencies • Polling: April 23, 2026" },
};
