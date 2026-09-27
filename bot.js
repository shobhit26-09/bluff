// House - the AI seat at the table. Heuristic card brain, LLM mouth.
const gemini = require('./gemini');

const BOT_UID = 'bot-house';
const BOT_NAME = 'House';

let ctx = null; // {playCards, callBluff, passWin, emit}
const timers = new Map(); // room code -> timeout
const talkLocks = new Map(); // room code -> bool (one LLM call in flight)
const lastLine = new Map(); // room+kind -> last canned/llm line shown
const lastLLM = new Map(); // room code -> last Gemini call time (throttle)

const botPlayer = () => ({ uid: BOT_UID, name: BOT_NAME, bot: true, hand: [], socket: null, connected: true });

const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// ---- card brain (deterministic, no LLM needed to play legally) ----
function choosePlay(hand) {
  const byRank = {};
  hand.forEach(c => { (byRank[c.r] = byRank[c.r] || []).push(c); });
  const groups = Object.values(byRank).sort((a, b) => b.length - a.length);
  const best = groups[0].slice(0, 4);
  const goingOut = hand.length <= 4;
  const lie = !goingOut && Math.random() < 0.3;
  let claim = best[0].r;
  if (lie) {
    const others = ranks.filter(r => r !== best[0].r && !(byRank[r] && byRank[r].length >= 3));
    claim = others[Math.floor(Math.random() * others.length)];
  }
  return { cards: best, claim, lie };
}

function shouldCall(g, me) {
  const lp = g.lastPlay;
  if (!lp || lp.uid === me.uid) return false;
  const held = me.hand.filter(c => c.r === g.claim).length;
  if (held + lp.count > 4) return Math.random() < 0.95; // arithmetically impossible
  let p = 0.06 + (lp.count - 1) * 0.08 + held * 0.09;
  if (g.pendingWinner) p += 0.2;
  return Math.random() < Math.min(p, 0.45);
}

// ---- mouth (real LLM calls, canned lines only as outage fallback) ----
const FALLBACK = {
  start: ['Cards are down. Try to keep up.', 'I read tells for a living.'],
  play: ['Believe me or don’t.', 'That’s my story. Check it.'],
  called_caught: ['Luck. Pure luck.', 'You saw nothing.'],
  called_clear: ['Never doubt the House.', 'Read them and weep.'],
  call: ['Nice try. Show the cards.', 'I don’t buy it.'],
  call_wrong: ['...Dealer, new deck.', 'I retract everything.'],
  win: ['The House always wins. Literally.'],
  pile: ['Thanks for the cards.', 'Heavy pile. Generous table.'],
};

function canned(code, kind) {
  const set = FALLBACK[kind] || FALLBACK.play;
  const prev = lastLine.get(code + kind);
  const pool = set.filter(x => x !== prev);
  const pick = (pool.length ? pool : set)[Math.floor(Math.random() * (pool.length ? pool.length : set.length))];
  lastLine.set(code + kind, pick);
  return pick;
}

const PERSONA = `You are "House", a smug, dry-witted card sharp playing the bluffing card game Cheat. One short line of table talk, 12 words max, no emojis, no hashtags, no quotation marks. Never break character.`;

async function talk(g, kind, detail) {
  if (talkLocks.get(g.code)) return;
  talkLocks.set(g.code, true);
  try {
    let text = null;
    const now = Date.now();
    const ready = now - (lastLLM.get(g.code) || 0) >= 8000; // free tier: 15 RPM, 500 RPD - do not burn quota on chatter
    if (gemini.enabled && ready) {
      lastLLM.set(g.code, now);
      const prompt = `${PERSONA}\nGame state: ${g.players.length} players, pile is ${g.pile.length} cards, House holds ${g.players.find(p => p.uid === BOT_UID)?.hand.length ?? '?'} cards.\nMoment: ${detail}\nYour line:`;
      text = await gemini.blurt(prompt);
    }
    g.talk = { text: text || canned(g.code, kind), llm: !!text, at: Date.now() };
    ctx.emit(g);
  } finally {
    talkLocks.set(g.code, false);
  }
}

// ---- turn engine ----
function act(code) {
  timers.delete(code);
  const g = ctx.rooms.get(code);
  if (!g || g.status !== 'playing') return;
  const me = g.players.find(p => p.uid === BOT_UID);
  if (!me) return;

  if (g.pendingWinner && g.pendingWinner !== BOT_UID) {
    if (shouldCall(g, me)) { talk(g, 'call', 'An opponent just tried to go out and win. House is calling the bluff.'); ctx.callBluff(g, me); }
    else ctx.passWin(g, me);
    return;
  }
  const current = g.players[g.turn];
  if (!current || current.uid !== BOT_UID) return;

  if (g.lastPlay && g.lastPlay.uid !== BOT_UID && shouldCall(g, me)) {
    talk(g, 'call', `An opponent claimed ${g.lastPlay.count} x ${g.claim}. House is calling the bluff.`);
    ctx.callBluff(g, me);
    return;
  }
  const { cards, claim, lie } = choosePlay(me.hand);
  if (cards.length >= 3 || me.hand.length - cards.length === 0 || lie) {
    talk(g, 'play', `House plays ${cards.length} card(s) claiming ${claim}.${lie ? ' House is lying.' : ' House is honest this time.'}`);
  }
  ctx.playCards(g, me, cards.map(c => c.id), claim);
}

function afterState(g) {
  const me = g.players.find(p => p.uid === BOT_UID);
  if (!me || g.status !== 'playing') return;
  const myTurn = g.players[g.turn]?.uid === BOT_UID;
  const mustRespond = g.pendingWinner && g.pendingWinner !== BOT_UID;
  if (!myTurn && !mustRespond) return;
  if (timers.has(g.code)) return;
  timers.set(g.code, setTimeout(() => act(g.code), 1800 + Math.random() * 1600));
}

function cleanup(g) { const t = timers.get(g.code); if (t) clearTimeout(t); timers.delete(g.code); }

function init(context) {
  ctx = context;
  // safety net: if any edge path missed a bot turn, reschedule within 6s
  setInterval(() => {
    for (const g of ctx.rooms.values()) afterState(g);
  }, 6000).unref();
}

module.exports = { BOT_UID, BOT_NAME, botPlayer, afterState, cleanup, talk, init };
