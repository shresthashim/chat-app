import { Wordmark } from "@/components/brand";

/**
 * The auth hero. Rather than a generic stat block, it shows the product itself:
 * a small, frozen-in-motion conversation with presence and a typing ripple —
 * the single most characteristic thing in a messaging app's world.
 */
export function AuthShowcase() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
      {/* Ambient gradient wash */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#5a4bff] opacity-30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#ff5c7a] opacity-25 blur-[120px]" />

      <Wordmark className="relative text-background [&_span]:text-background" />

      <div className="relative flex flex-col gap-3">
        <Bubble side="in" delay="0s">
          Did the build pass? 👀
        </Bubble>
        <Bubble side="out" delay="0.15s">
          Green across the board. Shipping now.
        </Bubble>
        <Bubble side="in" delay="0.3s">
          You&apos;re the best. 🙌
        </Bubble>
        <div className="ml-1 flex items-center gap-2 text-background/60">
          <span className="flex gap-1 rounded-full bg-background/10 px-3 py-2.5">
            <Dot /> <Dot delay="0.2s" /> <Dot delay="0.4s" />
          </span>
          <span className="text-xs">Maya is typing…</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="font-display text-3xl font-bold leading-tight text-balance">
          Conversations that feel <span className="gradient-text">alive</span>.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-background/70">
          Real-time messages, presence, typing, reactions and read receipts — for one-on-one chats
          and groups alike.
        </p>
      </div>
    </aside>
  );
}

function Bubble({ side, delay, children }: { side: "in" | "out"; delay: string; children: React.ReactNode }) {
  const isOut = side === "out";
  return (
    <div
      className={`max-w-[78%] animate-message-in rounded-2xl px-4 py-2.5 text-sm ${
        isOut
          ? "self-end gradient-brand text-white rounded-br-md"
          : "self-start bg-background/10 text-background rounded-bl-md"
      }`}
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      {children}
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return <span className="h-1.5 w-1.5 animate-typing rounded-full bg-background/70" style={{ animationDelay: delay }} />;
}
