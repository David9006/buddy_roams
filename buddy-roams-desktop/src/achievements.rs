//! Achievement catalog, unlock state, progress tracking, and persistence for
//! the desktop pet, ported from the VS Code extension's achievement system.
//!
//! The catalog, rewards, hints and the Fruit Slasher → Wizard Slasher
//! dependency mirror the extension. `firefighter` (fix code errors) has no
//! desktop equivalent and is intentionally absent.

use std::collections::HashSet;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

// Achievement tuning (mirrors the extension's engine.js constants).
pub const SLASHER_CATCHES_REQUIRED: u32 = 20;
pub const SLASHER_MIN_DOWN_VELOCITY: f64 = 300.0; // px/s downward swipe
pub const PARTY_LOVER_STREAK_REQUIRED: u32 = 4;
pub const BREATHE_REQUIRED: u32 = 10;
pub const SLEEPER_MS_REQUIRED: u64 = 30 * 60 * 1000; // 30 minutes
pub const SLEEP_WAKE_CHECK_INTERVAL: u64 = 1_000; // ms between wake checks
pub const SLEEP_WAKE_CHANCE_PER_CHECK: f64 = 1.0 / 1200.0; // ~20 min expected

#[derive(Clone, Copy)]
pub struct Reward {
    pub accessory: Option<&'static str>,
    pub color: Option<&'static str>,
}

pub struct Achievement {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub hint: &'static str,
    pub reward: Option<Reward>,
}

pub const ACHIEVEMENTS: &[Achievement] = &[
    Achievement {
        id: "fruitSlasher",
        name: "Fruit Slasher",
        description: "Catch the pet 20 times with a downward mouse swipe.",
        hint: "???",
        reward: Some(Reward { accessory: Some("strawHat"), color: None }),
    },
    Achievement {
        id: "wizardSlasher",
        name: "Wizard Slasher",
        description: "Catch a wizard-hat pet 20 times with a downward mouse swipe (requires Fruit Slasher).",
        hint: "???",
        reward: Some(Reward { accessory: Some("bambooHat"), color: None }),
    },
    Achievement {
        id: "tamed",
        name: "Tamed",
        description: "Bounce a wizard-hat pet 20 times in a single combo.",
        hint: "???",
        reward: Some(Reward { accessory: Some("whiteChefHat"), color: None }),
    },
    Achievement {
        id: "coser",
        name: "Coser",
        description: "Wear every reward accessory at least once.",
        hint: "Try on every hat you have earned.",
        reward: Some(Reward { accessory: None, color: Some("insiders") }),
    },
    Achievement {
        id: "dizzy",
        name: "Dizzy",
        description: "Make the pet dizzy.",
        hint: "Confuse the pet with rapid direction changes.",
        reward: Some(Reward { accessory: Some("spinnerHat"), color: None }),
    },
    Achievement {
        id: "technoblade",
        name: "Technoblade Never Dies",
        description: "Type the Technoblade quote in your code.",
        hint: "???",
        reward: Some(Reward { accessory: Some("crown"), color: Some("#ed83b5") }),
    },
    Achievement {
        id: "breathe",
        name: "Breathe in, breathe out",
        description: "Grow and shrink the pet repeatedly.",
        hint: "???",
        reward: None,
    },
    Achievement {
        id: "glider",
        name: "Glider",
        description: "Glide down wearing the spinner hat.",
        hint: "???",
        reward: Some(Reward { accessory: Some("propellerHat"), color: None }),
    },
    Achievement {
        id: "sleeper",
        name: "Sleeper",
        description: "Spend 30 minutes asleep.",
        hint: "Let the pet nap for a while.",
        reward: Some(Reward { accessory: Some("wizardHat"), color: None }),
    },
    Achievement {
        id: "partyLover",
        name: "Party Lover",
        description: "Trigger yapping, singing, or a spin 4 times in a row.",
        hint: "Keep clicking until the pet celebrates.",
        reward: Some(Reward { accessory: Some("partyHat"), color: None }),
    },
    Achievement {
        id: "grandmaster",
        name: "Grandmaster",
        description: "Unlock every other achievement.",
        hint: "Unlock every other achievement.",
        reward: Some(Reward { accessory: Some("topHatMonocle"), color: None }),
    },
];

/// Colors the pet starts with before any achievement: just the default stable
/// color. Everything else must be unlocked.
pub const BASE_COLORS: &[&str] = &["stable"];

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Progress {
    #[serde(default)]
    pub sleep_ms: u64,
    #[serde(default)]
    pub breathe: u32,
    #[serde(default)]
    pub equipped: Vec<String>,
}

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct AchievementsState {
    #[serde(default)]
    pub unlocks: HashSet<String>,
    #[serde(default)]
    pub progress: Progress,
}

pub struct Achievements {
    pub state: AchievementsState,
    path: PathBuf,
}

impl Achievements {
    pub fn load(path: PathBuf) -> Self {
        let state = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<AchievementsState>(&text).ok())
            .unwrap_or_default();
        Self { state, path }
    }

    pub fn save(&self) {
        if let Some(dir) = self.path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(
            &self.path,
            serde_json::to_string_pretty(&self.state).unwrap_or_default(),
        );
    }

    pub fn is_unlocked(&self, id: &str) -> bool {
        self.state.unlocks.contains(id)
    }

    pub fn achievement(id: &str) -> Option<&'static Achievement> {
        ACHIEVEMENTS.iter().find(|a| a.id == id)
    }

    /// Marks `id` unlocked (if not already) and persists. Returns the unlocked
    /// achievement's name and reward so the caller can apply/celebrate it.
    pub fn unlock(&mut self, id: &str) -> Option<(&'static str, Option<Reward>)> {
        if self.is_unlocked(id) {
            return None;
        }
        let a = Self::achievement(id)?;
        self.state.unlocks.insert(id.to_string());
        self.save();
        Some((a.name, a.reward))
    }

    /// Accessories unlocked by earned rewards (menu gating).
    pub fn unlocked_accessories(&self) -> Vec<&'static str> {
        let mut ids = Vec::new();
        for a in ACHIEVEMENTS {
            if self.is_unlocked(a.id) {
                if let Some(r) = a.reward {
                    if let Some(acc) = r.accessory {
                        if !ids.contains(&acc) {
                            ids.push(acc);
                        }
                    }
                }
            }
        }
        ids
    }

    /// Colors unlocked by earned rewards, always including the base colors
    /// (menu gating).
    pub fn unlocked_colors(&self) -> Vec<&'static str> {
        let mut colors = BASE_COLORS.to_vec();
        for a in ACHIEVEMENTS {
            if self.is_unlocked(a.id) {
                if let Some(r) = a.reward {
                    if let Some(color) = r.color {
                        if !colors.contains(&color) {
                            colors.push(color);
                        }
                    }
                }
            }
        }
        colors
    }

    /// Reward accessories required by the Coser achievement (every reward
    /// accessory except Grandmaster's, which can only be earned last).
    fn coser_accessories() -> Vec<&'static str> {
        let mut ids = Vec::new();
        for a in ACHIEVEMENTS {
            if a.id == "grandmaster" {
                continue;
            }
            if let Some(r) = a.reward {
                if let Some(acc) = r.accessory {
                    if !ids.contains(&acc) {
                        ids.push(acc);
                    }
                }
            }
        }
        ids
    }

    /// Records that an accessory was equipped; returns `true` when the Coser
    /// achievement should now be unlocked.
    pub fn note_accessory_equipped(&mut self, id: &str) -> bool {
        if self.is_unlocked("coser") {
            return false;
        }
        if !self.state.progress.equipped.iter().any(|e| e == id) {
            self.state.progress.equipped.push(id.to_string());
            self.save();
        }
        let required = Self::coser_accessories();
        !required.is_empty()
            && required
                .iter()
                .all(|r| self.state.progress.equipped.iter().any(|e| e == r))
    }

    /// Accumulates sleep time; returns `true` when the Sleeper achievement
    /// should now be unlocked.
    pub fn note_sleep(&mut self, ms: u64) -> bool {
        if self.is_unlocked("sleeper") {
            return false;
        }
        self.state.progress.sleep_ms = self.state.progress.sleep_ms.saturating_add(ms);
        self.save();
        self.state.progress.sleep_ms >= SLEEPER_MS_REQUIRED
    }

    /// Records one grow/shrink action; returns `true` when the Breathe
    /// achievement should now be unlocked.
    pub fn note_breathe(&mut self) -> bool {
        if self.is_unlocked("breathe") {
            return false;
        }
        self.state.progress.breathe += 1;
        self.save();
        self.state.progress.breathe >= BREATHE_REQUIRED
    }
}
