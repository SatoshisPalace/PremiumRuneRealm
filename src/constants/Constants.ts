export interface SpriteCategory {
  name: string;
  folder: string;
  defaultOption: string;
  options: string[];
}
export const AdminSkinChanger = "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI"
// export const TARGET_BATTLE_PID = "W111mH0QHpqVMQ6z3ayHEQWC94xqETy2G8qceQUaFRQ"
export const TARGET_BATTLE_PID = "3ZN5im7LNLjr8cMTXO2buhTPOfw6zz00CZqNyMWeJvs"
export const Alter = "GhNl98tr7ZQxIJHx4YcVdGh7WkT9dD7X4kmQOipvePQ"
export const DefaultAtlasTxID = "sVIX0l_PFC6M7lYpuEOGJ_f5ESOkMxd5f5xCQSUH_2g"
export const Gateway = "https://arweave.dev/"

// Battle position constants
export const BATTLE_POSITIONS = {
  HOME_OFFSET: '15%',    // Distance from edge in home position
  ATTACK_OFFSET: '55%',  // Distance from edge in attack position
} as const;

// Activity point values
export const ACTIVITY_POINTS = {
  OFFERING: 10,
  FEED: 1,
  PLAY: 2,
  MISSION: 3
} as const;

export const SPRITE_CATEGORIES: SpriteCategory[] = [
  {
    name: 'Hair',
    folder: 'Hair',
    defaultOption: 'None',
    options: [
      'None',
      'Girl',
      'Boy',
    ]
  },
  {
    name: 'Hat',
    folder: 'Hat',
    defaultOption: 'None',
    options: [
      'None',
      'Beanie',
    ]
  },
  {
    name: 'Shirt',
    folder: 'Shirt',
    defaultOption: 'None',
    options: [
      'None',
      'Shirt',
      'Coat',
    ]
  },
  {
    name: 'Pants',
    folder: 'Pants',
    defaultOption: 'None',
    options: [
      'None',
      'Pants',
      'Skirt',
      'Shorts'
    ]
  },
  {
    name: 'Gloves',
    folder: 'Gloves',
    defaultOption: 'None',
    options: [
      'None',
      'Gloves',
    ]
  },
  {
    name: 'Shoes',
    folder: 'Shoes',
    defaultOption: 'None',
    options: [
      'None',
      'Shoes',
    ]
  },
];

export const PUBLIC_ASSETS_PATH = '/assets';


export const SUPPORTED_ASSET_IDS = [
    "XJjSdWaorbQ2q0YkaQSmylmuADWH1fh2PvgfdLmXlzA",  // Air berries
    "twFZ4HTvL_0XAIOMPizxs_S3YH5J5yGvJ8zKiMReWF0",  // Water berries
    "2NoNsZNyHMWOzTqeQUJW9Xvcga3iTonocFIsgkWIiPM",  // Rock berries
    "30cPTQXrHN76YZ3bLfNAePIEYDb5Xo1XnbQ-xmLMOM0",  // Fire berries
    "4sKr4cf3kvbzFyhM6HmUsYG_Jz9bFZoNUrUX5KoVe0Q",  // Rune
    "f1KnnMFYR125aQo0zYKgL0PzgJL__fO8JOtDfuIDdHo",  // Scroll
    "C19KuCwx1VRH4WItj9wYUu1DIkdvareU3aMmojVZJf4",  // Emerald
    "rNVB_bYcNLk6OgcbyG8MEmxjGo76oj3gFzLBCWOhqXI",  // Ruby
    "R5UGOfFboMv-zlaSSDgRqxRILmGgPPe5BlnPf5F4i3A",  // Topaz
    "wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ",  // TRUNK token
    "OsK9Vgjxo0ypX_HLz2iJJuh4hp3I80yA9KArsJjIloU"   // NAB token
] as const;

export type SupportedAssetId = typeof SUPPORTED_ASSET_IDS[number];

export interface AssetInfo {
    processId: SupportedAssetId;
    logo: string;
    name: string;
    ticker: string;
    denomination: number;
}

export const ASSET_INFO: Partial<Record<SupportedAssetId, AssetInfo>> = {
    "wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ": {
        processId: "wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ",
        logo: "hqg-Em9DdYHYmMysyVi8LuTGF8IF_F7ZacgjYiSpj0k",
        name: "TRUNK Token",
        ticker: "TRUNK",
        denomination: 3
    },
    "OsK9Vgjxo0ypX_HLz2iJJuh4hp3I80yA9KArsJjIloU": {
        processId: "OsK9Vgjxo0ypX_HLz2iJJuh4hp3I80yA9KArsJjIloU",
        logo: "LQ4crOHN9qO6JsLNs253AaTch6MgAMbM8PKqBxs4hgI",
        name: "NAB Token",
        ticker: "NAB",
        denomination: 8
    }
};

// Triple the timeout value for asset loading as requested
export const WAITTIMEOUIT = 22500;
export const MAX_RETRIES = 3;        // Number of retries for failed asset loads
export const RETRY_DELAY = 10000;    // Delay between retries in milliseconds
