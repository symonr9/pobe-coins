/**
 * Chubbybara's handwritten lines. Placeholders: {name}, {coins}, {task}, {goal}, {left},
 * {streak}, {partner}, {item}, {debt}. Tone: warm, kind, never shaming, a little silly.
 * Capybara facts and yuzu references are his thing.
 */
import type { ChubbyPose } from '../art';

export type LineContext =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'affirmation'
  | 'taskDone'
  | 'taskPending'
  | 'approved'
  | 'rejected'
  | 'bonus'
  | 'streakMilestone'
  | 'streakFresh'
  | 'streakAtRisk'
  | 'goalProgress'
  | 'goalReached'
  | 'purchase'
  | 'reward'
  | 'cosmetic'
  | 'giftSent'
  | 'giftReceived'
  | 'iou'
  | 'iouPaid'
  | 'comeback'
  | 'challengeWon'
  | 'allDone'
  | 'shopGreeting'
  | 'emptyTasks'
  | 'emptyTimeline'
  | 'emptyGoals'
  | 'emptyShop'
  | 'offline';

export interface LineSet {
  pose: ChubbyPose;
  lines: string[];
}

export const LINES: Record<LineContext, LineSet> = {
  morning: {
    pose: 'wave',
    lines: [
      'Good morning, {name}! I saved you the sunniest spot.',
      'Rise and shine, {name}! Today looks very doable.',
      'Morning! I already had my yuzu. Your turn to have a great day.',
      "Hi {name}! One small chore before coffee? Or after. I don't judge.",
      'Good morning! Capybaras start slow too. That counts as a start.',
      'The day is fresh and so are you, {name}.',
      'Morning, {name}! Your purse says hi. It has {coins} coins in it.',
      "Hello, sunshine. Let's make today cozy.",
      'Good morning! Tiny steps still move you forward.',
      'Morning! I believe in you, and also in breakfast.',
      'Hi {name}! Something tells me today is going to be good.',
      "Good morning! Remember to drink some water. I'm a water mammal, I know these things.",
    ],
  },
  afternoon: {
    pose: 'idle',
    lines: [
      "Good afternoon, {name}! How's the day treating you?",
      "Afternoon check-in: you're doing better than you think.",
      'Hi {name}! Perfect time for a snack and a small chore.',
      'Halfway through the day! Proud of you already.',
      'Afternoon, {name}. A tidy corner makes a happy capybara.',
      'Hello again! Want to knock out a quick one together?',
      'Good afternoon! Stretch, breathe, then maybe dishes.',
      'Hey {name}! Your purse has {coins} coins. Just saying.',
      'Afternoon slump? Pick the tiniest task. Momentum is magic.',
      "Hi! I'm cheering for you from the POBE Shop.",
    ],
  },
  evening: {
    pose: 'happy',
    lines: [
      'Good evening, {name}! Time to wind down soon.',
      'Evening! Whatever you got done today was enough.',
      'Hi {name}! A little reset tonight makes tomorrow easier.',
      'The sun is setting and you did good today.',
      'Evening, {name}. Cozy socks recommended.',
      'Almost time to rest. One last small win?',
      "Good evening! Let's celebrate the little things.",
      "Hey {name}, look at you, still going. Don't forget to rest.",
      "Evening check-in: you're doing great.",
      'Time for a warm drink and a soft blanket, I think.',
    ],
  },
  night: {
    pose: 'sleepy',
    lines: [
      "It's late, {name}. The chores will wait. Sleep well.",
      'Zzz… oh! Hi. Go to bed, you wonderful human.',
      'Nighttime is for resting. See you tomorrow.',
      'Sweet dreams, {name}. You earned them.',
      'The moon is out and so am I. Goodnight!',
      'Rest is productive too. Goodnight, {name}.',
      "Tuck in, turn off, recharge. I'll guard the coins.",
      'Late-night chores? Brave. But please sleep soon.',
    ],
  },
  affirmation: {
    pose: 'happy',
    lines: [
      "You don't have to do everything. Just the next thing.",
      'Small chores add up to a cozy home.',
      "You're allowed to go slow. Capybaras invented slow.",
      "Every coin in your purse is a thing you did. That's neat.",
      'Rest is part of the routine.',
      'You make this home nicer just by being in it.',
      'Progress, not perfection.',
      'Being kind to yourself counts as a chore. Full points.',
      'Your future self says thank you.',
      'A little effort today is a little ease tomorrow.',
      'Teamwork makes the home work.',
      'Done is better than perfect. Especially folding fitted sheets.',
      "Capybaras get along with everyone. You're pretty great too.",
      "Whatever today looks like, you're doing your best.",
      'Tiny wins are still wins.',
      'Your pace is the right pace.',
      "Take a breath. You've got this.",
      'Some days are chore days, some days are couch days. Both are okay.',
      "You're building something cozy, one coin at a time.",
      "Look at all you've done. I'm so proud of you.",
      "Home isn't a place you clean, it's a place you share.",
      'Gentle reminder: you are doing enough.',
      'Capybara fact: we can nap in water with just our noses sticking out. Rest anywhere!',
      "Capybara fact: we're the world's largest rodents. Also the world's chillest.",
      'Capybara fact: birds like to sit on our heads. We let them. Be the capybara.',
      "Capybara fact: we're very social. Chores are better with friends too.",
      "Capybara fact: in Japan, capybaras soak in yuzu hot springs. That's where my hat comes from!",
      'Capybara fact: our teeth never stop growing. Neither do you.',
      'Capybara fact: we have webbed feet. Great for splashing, bad for folding laundry.',
      "Capybara fact: a group of capybaras is called a herd. You're my herd.",
      "You showed up today. That's the hardest part.",
      'Even a crumb of effort is still effort. Crumbs add up to cookies.',
      'Remember when this list felt big? Look at you now.',
      "It's okay to ask for help. That's what households are for.",
      'Being here and trying is already a win.',
    ],
  },
  taskDone: {
    pose: 'cheer',
    lines: [
      '{task}: done! +{coins} coins in the purse.',
      'Yay! {task} is finished. Here are {coins} shiny coins.',
      'Look at you go! +{coins} for {task}.',
      'Clink clink! {coins} coins for {task}.',
      'Done and dusted! Literally, maybe. +{coins}.',
      "That's {coins} coins closer to something nice.",
      'Chore complete! My tail would wag if I had much of one.',
      'Nice work on {task}! Treat yourself to a stretch.',
      'Another one done! The house thanks you.',
      "+{coins}! You're on a roll.",
      'Wonderful! {task} crossed off. Cozy points increasing.',
      "Hooray! That's the stuff.",
      "{task}? Handled. You're amazing.",
      'Chore slayed. Coin collected. +{coins}.',
      'A job well done deserves a happy dance. +{coins}!',
      'Ding! {coins} coins for you.',
      'Checked off! Your future self is cheering.',
      'Look at that purse grow! +{coins}.',
    ],
  },
  taskPending: {
    pose: 'thinking',
    lines: [
      'Nice! {task} is waiting for a thumbs up from {partner}.',
      "Sent for approval. Coins arrive as soon as it's checked.",
      "I've put {task} in the approval basket.",
      'Waiting on a quick look, then {coins} coins are yours.',
      'Almost there! Just needs a nod from someone else.',
    ],
  },
  approved: {
    pose: 'happy',
    lines: [
      '{partner} approved {task}! +{coins} coins.',
      'Approved! Your coins just landed.',
      'Two thumbs up for {task}. Enjoy your {coins} coins!',
      "It's official: {coins} coins for you.",
      'Approved with love. Clink!',
    ],
  },
  rejected: {
    pose: 'thinking',
    lines: [
      "{task} wasn't approved this time. Maybe check in with {partner}?",
      'Not quite yet on {task}. No worries, you can try again.',
      'That one got sent back. A quick chat usually sorts it out.',
      "Hmm, not approved. Let's give it another go later.",
    ],
  },
  bonus: {
    pose: 'cheer',
    lines: [
      'Surprise! A {coins}-coin bonus just for you.',
      "Bonus coins! Someone thinks you're wonderful.",
      '+{coins} bonus! Spend it on something cozy.',
      'Look what fell into your purse: {coins} extra coins!',
    ],
  },
  streakMilestone: {
    pose: 'cheer',
    lines: [
      "{streak} in a row! Here's a {coins}-coin streak bonus.",
      'Streak milestone! {streak} times straight. +{coins}!',
      "You're on fire (the cozy fireplace kind). {streak} in a row!",
      'Consistency queen/king energy: {streak} straight! +{coins}.',
      "{streak}-streak! I made you a tiny trophy. It's imaginary. +{coins}.",
    ],
  },
  streakFresh: {
    pose: 'happy',
    lines: [
      'Fresh start on {task}! Every streak begins with one.',
      "New streak, who dis? Let's go!",
      "Streaks come and go. Today's a good day to start another.",
      "Day one again, and that's perfectly okay.",
      'Missed one? Happens to the best of us. Welcome back!',
    ],
  },
  streakAtRisk: {
    pose: 'thinking',
    lines: [
      "Psst, {name}: your {streak}-streak on {task} is waiting for today's check.",
      'Your {task} streak would love some attention today.',
      "Keep the {streak}-streak going? Just {task} and you're set.",
      'Gentle nudge: {task} today keeps the streak alive.',
    ],
  },
  goalProgress: {
    pose: 'happy',
    lines: [
      '{left} coins to go for {goal}!',
      'Your {goal} jar is filling up nicely.',
      'Almost there! {goal} is just {left} coins away.',
      'Every chore brings {goal} a little closer.',
      'Saving up for {goal}? Great taste.',
    ],
  },
  goalReached: {
    pose: 'cheer',
    lines: [
      'You did it! {goal} is fully saved up!',
      'Goal reached! {goal} is yours to enjoy.',
      'Confetti time! You saved enough for {goal}.',
      'All that hard work paid off. {goal} unlocked!',
      "Woohoo! {goal} achieved. I'm doing a happy wiggle.",
    ],
  },
  purchase: {
    pose: 'shopkeeper',
    lines: [
      'Enjoy {item}! You earned every coin.',
      'Thank you for shopping at POBE! {item} is yours.',
      'Great choice! {item} is well deserved.',
      'Receipt printed (in my heart). Enjoy {item}!',
      'Treat yourself! {item} logged.',
      'You worked for this one. Enjoy!',
      'Wrapped with care (not really, but imagine a bow). Enjoy {item}!',
      'Coins well spent! {item} is all yours.',
      'Another happy customer! Enjoy {item}.',
      'Hard work, sweet reward. Enjoy {item}!',
      'The POBE Shop thanks you! Enjoy {item}.',
      'Ka-ching! {item} is yours.',
      "Spending coins you earned feels extra good, doesn't it?",
      'Enjoy it guilt-free. You did the chores!',
      '{item}: bought with sweat, served with love.',
    ],
  },
  reward: {
    pose: 'shopkeeper',
    lines: [
      "{item}, coming right up! I'll let {partner} know.",
      'Reward redeemed: {item}. Enjoy it!',
      'One {item}, freshly redeemed. Delightful!',
      'Order up! {item} is on its way.',
    ],
  },
  cosmetic: {
    pose: 'cheer',
    lines: [
      'Ooh! Do I look fancy? Thank you!',
      'New look unlocked! I feel very stylish.',
      "I love it! I'm wearing it forever. Or until the next one.",
      'Fashion capybara reporting for duty!',
    ],
  },
  giftSent: {
    pose: 'happy',
    lines: [
      'You sent {coins} coins to {partner}. How sweet!',
      'Gift delivered! {partner} is going to smile.',
      'Sharing is caring. {coins} coins sent.',
      'That was kind. {partner} got {coins} coins from you.',
    ],
  },
  giftReceived: {
    pose: 'cheer',
    lines: [
      '{partner} sent you {coins} coins! Aww.',
      'A gift! {coins} coins from {partner}.',
      'Look! {partner} thought of you: +{coins}.',
      'Someone loves you: {coins} coins from {partner}.',
    ],
  },
  iou: {
    pose: 'thinking',
    lines: [
      'I wrote an IOU for {debt} coins. Your next chores will pay it back.',
      "No stress: {debt} coins on the tab. You'll catch up.",
      'Borrowed {debt} coins. Future you has got this.',
      "IOU noted. Earnings go to the tab first until it's clear.",
    ],
  },
  iouPaid: {
    pose: 'cheer',
    lines: ['IOU all paid off! Clean slate!', "Tab cleared! You're back in the green.", "No more IOU. That feels nice, doesn't it?"],
  },
  comeback: {
    pose: 'wave',
    lines: [
      'Welcome back, {name}! I missed you.',
      "Hi again! Let's ease back in with something small.",
      'There you are! The purse and I kept things warm.',
      'Long time no see! No catching up needed. Just start where you are.',
    ],
  },
  challengeWon: {
    pose: 'cheer',
    lines: [
      'Team win! Everyone gets {coins} bonus coins!',
      'Challenge complete! Party at the POBE Shop!',
      'You did it together! +{coins} for everyone.',
      'Teamwork unlocked a {coins}-coin party!',
    ],
  },
  allDone: {
    pose: 'happy',
    lines: [
      'All done for today! Go do something fun.',
      'Nothing left on the list. Time to relax!',
      "Clean slate! You're free, {name}.",
      "Every chore checked. I'm so proud of this household.",
    ],
  },
  shopGreeting: {
    pose: 'shopkeeper',
    lines: [
      'Welcome to the POBE Shop! You have {coins} coins to spend.',
      'Hello, valued customer! Browse as long as you like.',
      'Fresh rewards on the shelves today!',
      "What can I get you? Everything's priced in pure effort.",
      'Welcome in! I polished all the coins this morning.',
    ],
  },
  emptyTasks: {
    pose: 'thinking',
    lines: [
      'No chores yet! Tap + to add one, or pick from my starter list.',
      'An empty list. Peaceful. Want to add a task?',
      'Nothing to do? Add a chore and put a price on it.',
    ],
  },
  emptyTimeline: {
    pose: 'idle',
    lines: [
      "Your story starts with the first chore. Let's go!",
      'Nothing here yet. Complete a task and it shows up here.',
      "A blank page! I'm sitting here with my yuzu, ready to watch it fill up.",
    ],
  },
  emptyGoals: {
    pose: 'thinking',
    lines: [
      'What are you saving for? Add a wish and watch the jar fill up.',
      'No goals yet. Dream a little! Add something you want.',
      'Every big jar starts with one tiny coin. What should we save for?',
    ],
  },
  emptyShop: {
    pose: 'shopkeeper',
    lines: [
      'The shelves are empty! Add rewards your household can buy with coins.',
      'Stock the shop! Ideas: breakfast in bed, pick the movie, skip a chore.',
      "My counter is sparkling and my shelves are bare. Let's add some treats!",
    ],
  },
  offline: {
    pose: 'sleepy',
    lines: [
      "We're offline. You can look around, and changes will work once we're back.",
      "No internet right now. I'll wait with you.",
      "The internet wandered off for a nap. Everything's still here to look at.",
    ],
  },
};

/** Onboarding walkthrough (in order). */
export const ONBOARDING: { pose: ChubbyPose; title: string; body: string }[] = [
  { pose: 'wave', title: "Hi, I'm Chubbybara!", body: 'I run the POBE Shop. Here, chores turn into coins, and coins turn into treats.' },
  { pose: 'happy', title: 'Earn coins', body: 'Finish tasks and chores to earn coins. Each one has its own price.' },
  { pose: 'shopkeeper', title: 'Spend them', body: "Buy rewards, save up for wishes, or log things you bought. I'll keep the receipts." },
  {
    pose: 'thinking',
    title: 'Coins are real coins',
    body: 'Your purse holds 1s, 5s, 10s, 25s, 50s and 100s. When you spend, I make change for you.',
  },
  { pose: 'cheer', title: 'Better together', body: "Approve each other's chores, send gifts, and take on challenges as a team." },
];

/** Contextual help tips, keyed by screen. */
export const HELP: Record<string, { title: string; body: string }[]> = {
  home: [
    { title: 'Your purse', body: 'These are your coins by type. The big number is the total.' },
    {
      title: 'IOUs',
      body: "If you buy something you can't quite afford (and your household allows IOUs), the rest goes on a tab. Your next earnings pay it back first.",
    },
  ],
  tasks: [
    { title: 'Pool tasks', body: "Tasks with no one assigned are in the pool. Claim one and it's yours." },
    {
      title: 'Streaks',
      body: 'Do a recurring chore every time it comes around to build a streak. Some chores pay bonus coins at milestones.',
    },
    { title: 'Undo', body: 'Checked something by mistake? You can undo it for a few minutes.' },
  ],
  spend: [
    {
      title: 'Making change',
      body: 'I pay with your coins like a cash register: exact coins if I can, otherwise the smallest overpayment, with change back.',
    },
    { title: 'Approval', body: "Purchases over your household's limit wait for someone else to approve. The coins are held until then." },
  ],
  shop: [
    { title: 'Rewards', body: 'Household rewards are set by your admins. Once you buy one, the person who delivers it can mark it done.' },
    { title: 'Cosmetics', body: 'Dress me up! Cosmetics are just for fun and only cost coins.' },
  ],
  timeline: [{ title: 'Paid for by', body: 'Tap a purchase to see which chores paid for it.' }],
};
