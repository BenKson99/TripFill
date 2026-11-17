import { resolveActivities } from "../shared/activities.js";

const honoluluMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Girl", profile: "girl" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Boy", profile: "boy" as const, child: true, age: 8 },
  { id: "traveler-5", name: "Grandparent", profile: "grandparent" as const },
];

const londonMembers = [
  { id: "traveler-1", name: "Mom", profile: "woman" as const },
  { id: "traveler-2", name: "Dad", profile: "man" as const },
  { id: "traveler-3", name: "Boy", profile: "boy" as const, child: true, age: 10 },
  { id: "traveler-4", name: "Girl A", profile: "girl" as const, child: true, age: 7 },
  { id: "traveler-5", name: "Girl B", profile: "girl" as const, child: true, age: 7 },
];

export function honoluluLiveInput() {
  const interests = "volcano, turtles, surfing lessons, luau, beach";
  return {
    destination: "Honolulu",
    homeCity: "Seattle",
    start: "2027-07-01",
    end: "2027-07-08",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "flying" as const,
    interests,
    activities: resolveActivities({ interests, purpose: "Family" }),
    members: honoluluMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
}

export function londonLiveInput() {
  const interests = "Harry Potter, castles, double-decker bus, museums";
  return {
    destination: "London",
    homeCity: "Chicago",
    start: "2027-07-10",
    end: "2027-07-17",
    travelers: 5,
    purpose: "Family",
    style: "Mix" as const,
    travelMode: "flying" as const,
    interests,
    activities: resolveActivities({ interests, purpose: "Family" }),
    members: londonMembers,
    today: "2026-11-17",
    tz: "America/Detroit",
  };
}
