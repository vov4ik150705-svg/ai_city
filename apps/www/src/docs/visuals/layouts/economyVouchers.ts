import type { StateLayout } from "../stateLayout"

/** economy.md, "Vouchers": a voucher ends either in your wallet or back in your city, never both. */
export const economyVouchers: StateLayout = {
  width: 1160,
  height: 350,
  states: {
    CITY: { x: 150, y: 130, title: "Your city", sub: { text: "Capital", face: "note" } },
    VOUCHER: { x: 580, y: 130, title: "Voucher", sub: { text: "One city hour from the issue", face: "note" } },
    WALLET: { x: 1010, y: 130, title: "Your wallet", sub: { text: "$CORP", face: "mono" } },
    EXPIRED: { x: 580, y: 300, title: "Expired", sub: { text: "VOUCHER_EXPIRED", face: "mono" } },
  },
  transitions: [
    {
      from: "CITY",
      to: "VOUCHER",
      points: [{ x: 214, y: 118 }, { x: 345, y: 86 }, { x: 468, y: 118 }],
      label: { x: 345, y: 50, anchor: "middle" },
      lines: ["Withdraw", "checks hours, limits and coverage"],
    },
    {
      from: "VOUCHER",
      to: "WALLET",
      points: [{ x: 692, y: 118 }, { x: 811, y: 86 }, { x: 930, y: 118 }],
      label: { x: 811, y: 50, anchor: "middle" },
      lines: ["Present", "approve the transaction in your wallet"],
    },
    {
      from: "VOUCHER",
      to: "EXPIRED",
      points: [{ x: 580, y: 168 }, { x: 580, y: 270 }],
      label: { x: 596, y: 212, anchor: "start" },
      lines: ["Not presented in time", "after the chain read"],
    },
    {
      from: "EXPIRED",
      to: "CITY",
      points: [{ x: 509, y: 300 }, { x: 240, y: 290 }, { x: 150, y: 168 }],
      label: { x: 318, y: 328, anchor: "middle" },
      lines: ["the Capital returns to your city"],
    },
  ],
  notes: [{ spot: { x: 672, y: 300, anchor: "start" }, lines: ["either paid out or returned as Capital,", "never both"] }],
}
