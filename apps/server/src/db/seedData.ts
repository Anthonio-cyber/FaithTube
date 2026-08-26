/** Seed fixtures. Text is original, written for this platform. */

export interface SeedChannel {
  handle: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  description: string;
  location: string;
  ministry?: string;
  country: string;
  primaryCategory: string;
  subscribers: number;
  verified: boolean;
}

export interface SeedVideo {
  channelHandle: string;
  title: string;
  description: string;
  categorySlug: string;
  tags: string[];
  durationSeconds: number;
  transcript: string;
  views?: number;
  daysAgo?: number;
  isShort?: boolean;
  premiumOnly?: boolean;
  chapters?: Array<{ startSeconds: number; title: string }>;
}

export const SEED_CHANNELS: SeedChannel[] = [
  {
    handle: 'cornerstone-chapel',
    name: 'Cornerstone Chapel',
    ownerEmail: 'pastor.mensah@faithtube.example',
    ownerName: 'Pastor Daniel Mensah',
    description:
      'Verse-by-verse preaching from a congregation in Accra. New messages every Sunday, plus midweek Bible study.',
    location: 'Accra, Ghana',
    ministry: 'Cornerstone Chapel International',
    country: 'GH',
    primaryCategory: 'sermons',
    subscribers: 48210,
    verified: true,
  },
  {
    handle: 'open-word-study',
    name: 'The Open Word',
    ownerEmail: 'grace.lim@faithtube.example',
    ownerName: 'Grace Lim',
    description: 'Careful, unhurried Bible study. We read a book of Scripture from start to finish and let it speak.',
    location: 'Singapore',
    country: 'SG',
    primaryCategory: 'bible-studies',
    subscribers: 91400,
    verified: true,
  },
  {
    handle: 'still-waters-worship',
    name: 'Still Waters Worship',
    ownerEmail: 'ana.ferreira@faithtube.example',
    ownerName: 'Ana Ferreira',
    description: 'Acoustic worship, hymns and psalms recorded live in our small sanctuary in São Paulo.',
    location: 'São Paulo, Brazil',
    country: 'BR',
    primaryCategory: 'worship',
    subscribers: 132900,
    verified: true,
  },
  {
    handle: 'the-long-road-home',
    name: 'The Long Road Home',
    ownerEmail: 'marcus.hale@faithtube.example',
    ownerName: 'Marcus Hale',
    description: 'Testimonies from people God met at the end of themselves. Recorded honestly, edited gently.',
    location: 'Manchester, United Kingdom',
    country: 'GB',
    primaryCategory: 'testimonies',
    subscribers: 27650,
    verified: false,
  },
  {
    handle: 'lamplight-kids',
    name: 'Lamplight Kids',
    ownerEmail: 'nia.roberts@faithtube.example',
    ownerName: 'Nia Roberts',
    description: 'Animated Bible stories for children aged four to ten. Faithful to the text, gentle in the telling.',
    location: 'Cardiff, Wales',
    country: 'GB',
    primaryCategory: 'christian-animation',
    subscribers: 204300,
    verified: true,
  },
  {
    handle: 'go-and-tell',
    name: 'Go and Tell',
    ownerEmail: 'samuel.varghese@faithtube.example',
    ownerName: 'Samuel Varghese',
    description: 'Evangelism training, honest answers to hard questions, and stories from the field.',
    location: 'Kochi, India',
    ministry: 'Go and Tell Mission Network',
    country: 'IN',
    primaryCategory: 'evangelism',
    subscribers: 63800,
    verified: true,
  },
  {
    handle: 'kitchen-table-faith',
    name: 'Kitchen Table Faith',
    ownerEmail: 'hannah.olsen@faithtube.example',
    ownerName: 'Hannah Olsen',
    description: 'Marriage, parenting and family devotions for ordinary households trying to follow Jesus.',
    location: 'Minneapolis, United States',
    country: 'US',
    primaryCategory: 'family',
    subscribers: 41200,
    verified: false,
  },
  {
    handle: 'upper-room-youth',
    name: 'Upper Room Youth',
    ownerEmail: 'tobi.adeleke@faithtube.example',
    ownerName: 'Tobi Adeleke',
    description: 'Teaching and discipleship for teenagers who want more than a Sunday feeling.',
    location: 'Lagos, Nigeria',
    country: 'NG',
    primaryCategory: 'youth',
    subscribers: 78900,
    verified: false,
  },
];

export const SEED_VIDEOS: SeedVideo[] = [
  {
    channelHandle: 'cornerstone-chapel',
    title: 'Romans 8: No Condemnation, No Separation',
    description:
      'Part twelve of our journey through Romans. Pastor Daniel walks through Romans 8:1-11 and 8:31-39, showing how the ' +
      'same chapter that begins with "no condemnation" ends with "nothing can separate us." Preached at Cornerstone Chapel, Accra.',
    categorySlug: 'sermons',
    tags: ['romans', 'sermon', 'grace', 'assurance', 'expository preaching'],
    durationSeconds: 2760,
    views: 41280,
    daysAgo: 4,
    chapters: [
      { startSeconds: 0, title: 'Reading Romans 8:1-11' },
      { startSeconds: 380, title: 'What condemnation actually meant' },
      { startSeconds: 1120, title: 'Life in the Spirit' },
      { startSeconds: 1980, title: 'Nothing can separate us' },
      { startSeconds: 2500, title: 'Closing prayer' },
    ],
    transcript:
      'Turn with me to Romans chapter eight. Paul has spent seven chapters showing us our sin and our helplessness, and then ' +
      'he opens this chapter with the words that have carried the church for two thousand years: there is therefore now no ' +
      'condemnation for those who are in Christ Jesus. Not less condemnation. None. The apostle is not describing a feeling. ' +
      'He is describing a legal verdict handed down by God the Father because of what Jesus Christ accomplished at the cross. ' +
      'The law was powerless because our flesh was weak, so God sent his own Son to do what the law could never do. ' +
      'Now look at verse four. The righteous requirement of the law is fulfilled in us who walk according to the Spirit. ' +
      'This is the doctrine of justification meeting the daily reality of sanctification. The Holy Spirit who raised Jesus ' +
      'from the dead lives in you, and that same resurrection power is at work in your mortal body. ' +
      'Brothers and sisters, if you have believed the gospel this morning, you are not on probation with God. ' +
      'Now jump with me to verse thirty-one. If God is for us, who can be against us? He who did not spare his own Son but ' +
      'gave him up for us all, how will he not also with him graciously give us all things? Paul lists every enemy he can ' +
      'think of. Tribulation. Distress. Persecution. Famine. Nakedness. Danger. Sword. And he says in all these things we ' +
      'are more than conquerors through him who loved us. I have sat with members of this congregation in the hospital and ' +
      'at the graveside, and I can tell you this is not a slogan. It is the ground under your feet when everything else gives way. ' +
      'Let us pray. Father, thank you for the Lord Jesus Christ, who died and was raised and now intercedes for us. Amen.',
  },
  {
    channelHandle: 'cornerstone-chapel',
    title: 'The Prodigal Father: Luke 15 Reconsidered',
    description:
      'We call it the parable of the prodigal son, but Jesus tells it about a father who runs. A Sunday message on Luke 15:11-32.',
    categorySlug: 'sermons',
    tags: ['luke', 'parable', 'grace', 'repentance', 'sermon'],
    durationSeconds: 2280,
    views: 33940,
    daysAgo: 11,
    transcript:
      'Luke chapter fifteen. Jesus tells three parables in a row, and all three are about something lost being found. ' +
      'A sheep, a coin, and then a son. The younger son asks for his inheritance, which in that culture was to say to his ' +
      'father, I wish you were dead. And the father gives it to him. He goes to a far country and wastes everything, and ' +
      'when the famine comes he is feeding pigs, which for a Jewish audience is the bottom of the world. ' +
      'Then Scripture says he came to himself. That is repentance in four words. He rehearses a speech. Father, I have ' +
      'sinned against heaven and before you. But watch what happens. While he was still a long way off, his father saw him ' +
      'and felt compassion and ran and embraced him. In that culture a dignified man did not run. The father humiliates ' +
      'himself to reach his son before the village can. That is the gospel. God does not wait at the door with folded arms. ' +
      'He runs. And the son never finishes his speech, because the father is already calling for the robe and the ring. ' +
      'But Jesus does not end there. The elder brother will not come in. He has kept every rule and he has no joy, because ' +
      'he has been serving to earn what he already had. Religion without grace makes hard people. Both sons needed the ' +
      'father. One knew it. Church, which son are you this morning? Let us pray.',
  },
  {
    channelHandle: 'open-word-study',
    title: 'Philippians, Session 3: Joy That Does Not Depend on Circumstances',
    description:
      'Grace works through Philippians 1:12-30, written from a Roman prison. Bring your Bible and a pen. Study notes in the description.',
    categorySlug: 'bible-studies',
    tags: ['philippians', 'bible study', 'joy', 'suffering', 'paul'],
    durationSeconds: 3420,
    views: 58600,
    daysAgo: 6,
    chapters: [
      { startSeconds: 0, title: 'Where Paul is writing from' },
      { startSeconds: 540, title: 'Philippians 1:12-18' },
      { startSeconds: 1700, title: 'To live is Christ' },
      { startSeconds: 2800, title: 'Questions for your group' },
    ],
    transcript:
      'Welcome back to our study of Philippians. Last session we looked at Paul\'s thanksgiving. Today we are in chapter one, ' +
      'verse twelve through the end. Remember where Paul is as he writes this. He is under house arrest in Rome, chained to a ' +
      'Roman guard, and the letter is full of the word joy. That combination should stop us. ' +
      'Verse twelve. I want you to know, brothers, that what has happened to me has really served to advance the gospel. ' +
      'Paul does not say despite what happened. He says because of it. The whole imperial guard has heard about Christ, and ' +
      'other believers have grown bold. Notice he measures his circumstances by what they do for the gospel, not what they ' +
      'do for his comfort. ' +
      'Now verse fifteen is uncomfortable. Some preach Christ from envy and rivalry, wanting to afflict Paul in his ' +
      'imprisonment. And Paul says, what then? Only that in every way Christ is proclaimed, and in that I rejoice. He is not ' +
      'endorsing bad motives. He is saying the message is bigger than the messenger. ' +
      'Then verse twenty-one, one of the most quoted lines in Scripture. For to me to live is Christ, and to die is gain. ' +
      'Paul is genuinely torn. Departing to be with Christ is far better, but remaining is more necessary for the Philippians. ' +
      'That is a man whose life is not his own. ' +
      'Three questions for your group this week. First, what circumstance are you currently measuring by your comfort rather ' +
      'than by the gospel? Second, where does verse twenty-one sound like your life, and where does it not? Third, Paul says ' +
      'in verse twenty-nine that it has been granted to us not only to believe but also to suffer. What does it change to ' +
      'call suffering a grant? Read chapter two before next session.',
  },
  {
    channelHandle: 'open-word-study',
    title: 'How to Read a Psalm Without Flattening It',
    description:
      'Hebrew poetry does not work like English poetry. A practical session on parallelism, lament and the imprecatory psalms.',
    categorySlug: 'bible-studies',
    tags: ['psalms', 'hermeneutics', 'bible study', 'hebrew poetry', 'lament'],
    durationSeconds: 2640,
    views: 27400,
    daysAgo: 19,
    transcript:
      'Most of us come to the Psalms looking for a verse that will make us feel better, and then we hit Psalm eighty-eight, ' +
      'which ends with the word darkness, and we quietly close the book. Today I want to give you three tools. ' +
      'First, parallelism. Hebrew poetry rhymes ideas, not sounds. When Psalm nineteen says the heavens declare the glory of ' +
      'God, and the sky above proclaims his handiwork, that is one idea said twice. The second line is not new information. ' +
      'It deepens the first. Once you see this you will stop building doctrines on half a sentence. ' +
      'Second, the psalms of lament. Roughly a third of the Psalter is complaint addressed to God. Psalm thirteen: how long, ' +
      'O Lord? Will you forget me forever? That is Scripture. God put the language of protest in his own hymn book, which ' +
      'means your grief does not disqualify you from prayer. Most laments turn at some point toward trust, but not all of ' +
      'them do, and we should not force the turn. ' +
      'Third, the imprecatory psalms, where the writer asks God to break the teeth of the wicked. These trouble Christians, ' +
      'and they should. But notice what the psalmist is doing. He is handing his vengeance to God rather than taking it ' +
      'himself. Read them alongside Romans twelve, where Paul says never avenge yourselves but leave it to the wrath of God. ' +
      'The psalm and the epistle agree. ' +
      'Take Psalm forty-two this week and mark every line pair. You will see the structure open up.',
  },
  {
    channelHandle: 'still-waters-worship',
    title: 'Be Thou My Vision — Live at Still Waters',
    description:
      'The ancient Irish hymn, sung slowly, with cello and acoustic guitar. Recorded live in our sanctuary with the congregation.',
    categorySlug: 'worship',
    tags: ['hymn', 'worship', 'be thou my vision', 'acoustic worship', 'praise'],
    durationSeconds: 412,
    views: 187300,
    daysAgo: 2,
    transcript:
      'Be thou my vision, O Lord of my heart. Naught be all else to me, save that thou art. Thou my best thought by day or ' +
      'by night, waking or sleeping thy presence my light. Be thou my wisdom, and thou my true word. I ever with thee and ' +
      'thou with me, Lord. Thou my great Father, and I thy true son. Thou in me dwelling, and I with thee one. ' +
      'High King of heaven, my victory won, may I reach heaven\'s joys, O bright heaven\'s sun. Heart of my own heart, ' +
      'whatever befall, still be my vision, O ruler of all. ' +
      'Church, we sing that last verse as a prayer. Whatever befall. Whatever this week holds, still be my vision. ' +
      'Let us sing it once more together, and then we will pray.',
  },
  {
    channelHandle: 'still-waters-worship',
    title: 'Psalm 23 Set to Music (Full Worship Set)',
    description:
      'A forty-minute worship set built around Psalm 23. Includes original settings of verses one through six with room for prayer between songs.',
    categorySlug: 'worship',
    tags: ['psalm 23', 'worship', 'psalms', 'prayer', 'worship set'],
    durationSeconds: 2410,
    views: 96200,
    daysAgo: 9,
    transcript:
      'The Lord is my shepherd, I shall not want. He makes me lie down in green pastures. He leads me beside still waters. ' +
      'He restores my soul. Sing it with us. ' +
      'This psalm was written by a man who had been a shepherd himself, so he knew exactly what he was saying. A sheep does ' +
      'not lie down when it is afraid. If David says the shepherd makes me lie down, he is saying the shepherd has dealt ' +
      'with everything that would keep me on my feet. ' +
      'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and ' +
      'your staff, they comfort me. Notice the psalm changes from he to you right there in the valley. In the green pasture ' +
      'David talks about God. In the dark valley he talks to him. ' +
      'You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup overflows. ' +
      'Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever. ' +
      'Let us pray, and then we will sing the last setting together. Father, you are our shepherd. We have wanted for many ' +
      'things this week, and you have been faithful anyway. Lead us beside still waters. In Jesus name, amen.',
  },
  {
    channelHandle: 'the-long-road-home',
    title: 'Twelve Years in Addiction, and the Night It Broke',
    description:
      'Kwame tells the story of a decade lost to addiction, the church that kept the door open, and the night he finally walked ' +
      'through it. Recorded with his permission. Contains discussion of addiction and recovery.',
    categorySlug: 'testimonies',
    tags: ['testimony', 'addiction recovery', 'salvation', 'grace', 'my story'],
    durationSeconds: 1840,
    views: 71400,
    daysAgo: 7,
    transcript:
      'I was nineteen when it started and thirty-one when it stopped, and I do not remember most of what happened between. ' +
      'People ask what the lowest point was and I tell them it was not the hospital. It was a Tuesday afternoon when I ' +
      'realised I had stolen from my own mother and felt nothing about it. ' +
      'There was a church at the end of my road. I had been walking past it for years. An older man named Joseph used to ' +
      'stand outside on Sundays and he never once told me I should come in. He would just say, we are praying for you, ' +
      'Kwame. Every week. For four years. ' +
      'The night it broke I had nowhere to go and I sat on the step outside that church. Joseph found me there in the morning. ' +
      'He did not preach at me. He made me tea and he read me Luke fifteen, the part where the father runs. And I said, ' +
      'you do not understand what I have done. And he said, no, but God does, and he ran anyway. ' +
      'I gave my life to Jesus Christ on that step. I want to be honest with you, because testimonies get told badly. ' +
      'The addiction did not vanish. I went to a recovery programme and I still go to meetings. I have relapsed twice and ' +
      'the church walked me back both times. What changed that morning was not my behaviour. It was who I belonged to. ' +
      'If you are watching this and you are where I was, please talk to someone today. Find a church, find a doctor, find a ' +
      'programme. And know that God is not waiting for you to clean up first. He runs.',
  },
  {
    channelHandle: 'the-long-road-home',
    title: 'She Prayed for Her Husband for Nineteen Years',
    description: 'Elaine on faithfulness in prayer, disappointment, and what happened in the nineteenth year.',
    categorySlug: 'testimonies',
    tags: ['testimony', 'prayer', 'marriage', 'faithfulness', 'salvation'],
    durationSeconds: 1420,
    views: 44900,
    daysAgo: 15,
    transcript:
      'I started praying for Robert the week we married. He was not hostile to the faith. He was just not interested, and ' +
      'that is harder in some ways, because there is nothing to argue with. ' +
      'For the first few years I prayed like I was placing an order. Lord, save my husband, and here is roughly when it ' +
      'would be convenient. Then somewhere around year seven I stopped praying for the outcome and started praying because ' +
      'I loved them both. That sounds like a small change. It was not. ' +
      'There were years I was angry with God. I want to say that plainly because I have heard testimonies that skip it. ' +
      'I read James chapter one about counting it all joy and I put the Bible down for a fortnight. But I kept going to ' +
      'church, mostly out of habit, and habit carried me when feeling could not. ' +
      'In the nineteenth year Robert\'s brother died suddenly. He came to the funeral and heard the gospel preached, and on ' +
      'the drive home he said, I think I have been wrong about this. That was it. No lightning. A quiet sentence in a car. ' +
      'He was baptised the following spring. ' +
      'If you are praying for someone, I have no formula for you. I only know that the God who kept me praying for nineteen ' +
      'years was doing something in me the whole time, not just in Robert. Do not give up.',
  },
  {
    channelHandle: 'lamplight-kids',
    title: 'Daniel and the Lions — Animated Bible Story',
    description:
      'The story of Daniel in the lions\' den, from Daniel chapter 6. Animated for children aged 4 to 10. Family friendly, with a short prayer at the end.',
    categorySlug: 'christian-animation',
    tags: ['daniel', 'bible story for kids', 'animation', 'courage', 'prayer'],
    durationSeconds: 640,
    views: 312000,
    daysAgo: 5,
    transcript:
      'A long time ago there was a man named Daniel who loved God very much. Daniel lived in a country called Babylon, and ' +
      'the king liked him so much that he wanted to put Daniel in charge of the whole kingdom. ' +
      'But some of the other men were jealous. They watched Daniel to find something wrong with him, and do you know what ' +
      'they found? Nothing. Except one thing. Three times every day, Daniel opened his window and prayed to God. ' +
      'So the jealous men tricked the king into making a new rule. For thirty days, nobody was allowed to pray to anyone ' +
      'except the king. Anyone who did would be thrown into the den of lions. ' +
      'What do you think Daniel did? He went home, and he opened his window, and he prayed, just like always. Daniel loved ' +
      'God more than he was afraid of lions. ' +
      'The men told the king, and the king was very sad, because he liked Daniel. But a rule was a rule. So Daniel was put ' +
      'into the den with the lions, and a big stone was rolled across the door. ' +
      'All night the king could not sleep. At sunrise he ran to the den and shouted, Daniel! Has your God rescued you? ' +
      'And Daniel called back, my God sent his angel and shut the lions\' mouths! ' +
      'The king was so happy. He told everyone in the whole kingdom about the God of Daniel, the living God who rescues. ' +
      'Shall we pray? Dear God, thank you that you were with Daniel. Please help us to be brave and to talk to you every ' +
      'day, just like he did. Amen.',
  },
  {
    channelHandle: 'lamplight-kids',
    title: 'The Good Samaritan (Animated Parable)',
    description: 'Jesus tells a story about who our neighbour really is. From Luke 10. For ages 4 to 10.',
    categorySlug: 'christian-animation',
    tags: ['parable', 'good samaritan', 'animation', 'kindness', 'luke'],
    durationSeconds: 520,
    views: 208500,
    daysAgo: 21,
    transcript:
      'One day a man asked Jesus a question. Teacher, who is my neighbour? And Jesus, who loved to teach with stories, ' +
      'told him this one. ' +
      'A man was walking down a long dusty road when robbers attacked him. They took everything he had and left him hurt ' +
      'beside the road. ' +
      'Soon a priest came along the road. He saw the hurt man. And he crossed to the other side and kept walking. ' +
      'Then another important man came along. He looked at the hurt man too. And he also crossed over and kept walking. ' +
      'Then a Samaritan came along. Now in those days, the Samaritans and this man\'s people did not get along at all. ' +
      'But when the Samaritan saw him, his heart was filled with pity. He knelt down. He cleaned the man\'s wounds and ' +
      'bandaged them. He put him on his own donkey and walked beside him all the way to an inn, and he paid for the man to ' +
      'stay until he was better. ' +
      'Then Jesus asked, which of these three was a neighbour to the man who was hurt? And the answer was easy. The one who ' +
      'showed him mercy. ' +
      'And Jesus said, you go and do the same. ' +
      'Dear God, thank you for Jesus, who showed us what love looks like. Help us to be a good neighbour to everyone we ' +
      'meet today, even people who are different from us. Amen.',
  },
  {
    channelHandle: 'go-and-tell',
    title: 'Sharing the Gospel Without Sounding Like a Salesman',
    description:
      'Practical evangelism training. How to move an ordinary conversation toward Jesus honestly, and what to do when someone says no.',
    categorySlug: 'evangelism',
    tags: ['evangelism', 'gospel presentation', 'outreach', 'discipleship', 'witness'],
    durationSeconds: 2160,
    views: 51600,
    daysAgo: 8,
    transcript:
      'Most Christians I meet are not afraid of evangelism because they lack information. They are afraid because the last ' +
      'time they tried it, they sounded like someone selling something, and they could hear it in their own voice. ' +
      'So let us start with what the gospel actually is, because if you cannot say it plainly you will hide behind a script. ' +
      'God made us and we belong to him. We have all turned away, and that turning away is what the Bible calls sin, and it ' +
      'has real consequences. Jesus Christ, fully God and fully man, lived the life we could not live and died the death we ' +
      'deserved, and God raised him from the dead. Anyone who turns from sin and trusts him is forgiven and made new. ' +
      'That is four sentences. Learn to say them in your own words. ' +
      'Now, three practical things. First, ask better questions and then be quiet. Most conversations about faith fail ' +
      'because we are waiting to talk instead of listening. Ask someone what they were raised to believe and what changed. ' +
      'Second, tell your own story before you tell them theirs. First Peter three fifteen says always be prepared to give ' +
      'an answer for the hope that is in you, with gentleness and respect. Notice both halves of that verse. ' +
      'Third, when someone says no, take the no. Pressure is not the Holy Spirit. Paul planted, Apollos watered, God gave ' +
      'the growth. Your job is faithfulness, not results. ' +
      'This week, have one conversation. Not a presentation. A conversation. And pray before you open your mouth.',
  },
  {
    channelHandle: 'go-and-tell',
    title: 'Answering "How Can a Good God Allow Suffering?"',
    description:
      'An apologetics session on the problem of evil. We look at the standard objection honestly before responding from Scripture.',
    categorySlug: 'evangelism',
    tags: ['apologetics', 'suffering', 'problem of evil', 'answering objections', 'evangelism'],
    durationSeconds: 2880,
    views: 68200,
    daysAgo: 13,
    transcript:
      'This is the objection that comes up more than any other, and I want us to feel its weight before we answer it. ' +
      'The argument goes like this. If God is all-powerful he could stop suffering. If he is all-good he would want to. ' +
      'Suffering exists. Therefore either he is not all-powerful, or he is not all-good, or he is not there. ' +
      'That is a serious argument and it deserves a serious answer, not a slogan. I am going to say four things. ' +
      'First, notice the objection assumes evil is real. If there is no God, suffering is not evil, it is just what happens. ' +
      'The moment you call it wrong, you have borrowed a standard from somewhere. That does not prove Christianity, but it ' +
      'shows the objection cuts both ways. ' +
      'Second, Scripture never pretends suffering is fine. Read Job. Read Lamentations. Read Psalm eighty-eight, which ends ' +
      'in darkness with no resolution. The Bible gives grief a vocabulary rather than a lecture. ' +
      'Third, the Christian answer is not primarily an explanation. It is a person. At the centre of our faith is God ' +
      'himself, in Jesus Christ, being tortured to death. Whatever else that means, it means God has not stayed at a ' +
      'distance from human pain. ' +
      'Fourth, Romans eight twenty-eight says all things work together for good for those who love God. That verse is often ' +
      'misused as a way to shut down grief. Paul says it in a chapter that also talks about groaning and waiting. ' +
      'When someone brings you this objection, defending the faith with humility and fear, as Peter puts it, matters more ' +
      'than winning. Sit with them first. Sometimes the objection is really a wound.',
  },
  {
    channelHandle: 'kitchen-table-faith',
    title: 'Family Devotions That Actually Survive a Tuesday',
    description:
      'Ten minutes on building a family devotion habit that works with small children, tired parents and real schedules. Deuteronomy 6.',
    categorySlug: 'family',
    tags: ['family devotion', 'parenting', 'discipleship', 'deuteronomy', 'christian home'],
    durationSeconds: 980,
    views: 38700,
    daysAgo: 3,
    transcript:
      'We tried family devotions four times before it stuck, and the first three attempts failed for the same reason. ' +
      'We designed them for a family we did not have. ' +
      'Deuteronomy chapter six says these words shall be on your heart, and you shall teach them diligently to your ' +
      'children, and shall talk of them when you sit in your house, and when you walk by the way, and when you lie down, ' +
      'and when you rise. Notice that is not describing a meeting. It is describing a household where God is a normal ' +
      'subject of conversation. ' +
      'So here is what works for us now. Four minutes, not forty. One short passage read aloud. One question. One prayer. ' +
      'That is it. If the toddler is on the floor, the toddler is on the floor. ' +
      'The question matters more than the length. We ask: what does this tell us about God? Not what should we do, at least ' +
      'not first. Children learn law faster than grace if we let them, and we want them to know who God is before they ' +
      'know what he wants. ' +
      'And we pray out loud, badly, in front of them. Our children have heard us pray about money and about arguments we ' +
      'had that morning. That has taught them more about the Christian life than any curriculum. ' +
      'Start this week. Four minutes. One passage. If you miss a day, start again the next day without a speech about it.',
  },
  {
    channelHandle: 'kitchen-table-faith',
    title: 'Marriage: What Ephesians 5 Actually Asks of Husbands',
    description: 'A careful look at Ephesians 5:21-33, including the verse that comes before the famous one.',
    categorySlug: 'family',
    tags: ['marriage', 'ephesians', 'husbands', 'family', 'love'],
    durationSeconds: 1680,
    views: 29800,
    daysAgo: 17,
    transcript:
      'Ephesians five is the passage everyone has an opinion about, and most of those opinions start at verse twenty-two. ' +
      'So let us start at verse twenty-one, which is where Paul starts. Submitting to one another out of reverence for ' +
      'Christ. That sentence governs everything that follows. ' +
      'Then Paul addresses wives in three verses, and husbands in nine. Read them and count. Whatever else this passage is, ' +
      'the weight of it falls on the husband. ' +
      'Husbands, love your wives, as Christ loved the church and gave himself up for her. That is the standard. Not led ' +
      'her. Not managed her. Gave himself up for her. Christ did not lay down conditions before he laid down his life. ' +
      'I have counselled marriages where a man quoted verse twenty-two at his wife and had never once read verse ' +
      'twenty-five to himself. That is not headship. Scripture defines the husband\'s role by self-sacrifice, and any ' +
      'reading that turns it into control has left the text. ' +
      'Verse twenty-eight. He who loves his wife loves himself. Paul is saying you are one body now, so her flourishing is ' +
      'not in competition with yours. ' +
      'Practically, husbands, ask your wife this week what carrying her would look like on Thursday, and then do that. ' +
      'Not what you imagine it looks like. Ask her. Then pray together. That is where this passage lands.',
  },
  {
    channelHandle: 'upper-room-youth',
    title: 'You Are Not Your Worst Week',
    description:
      'A message for teenagers on identity, failure and what it means that God calls you his own. Preached at our Friday night gathering in Lagos.',
    categorySlug: 'youth',
    tags: ['youth', 'identity', 'grace', 'teens', 'discipleship'],
    durationSeconds: 1560,
    views: 82400,
    daysAgo: 6,
    transcript:
      'Put your hand up if you have had a bad week. Keep it up if you have had a bad week and then decided that the week ' +
      'was proof of something about you. That is the thing I want to talk about tonight. ' +
      'There is a difference between saying I did something wrong and saying I am the kind of person who is wrong. The ' +
      'first is repentance. The second is condemnation, and Romans eight one says there is now no condemnation for those ' +
      'who are in Christ Jesus. ' +
      'Look at Peter. Peter denied Jesus three times, out loud, in public, after promising he never would. If anyone ever ' +
      'had a worst week, it was that one. And in John twenty-one, the risen Jesus makes him breakfast on a beach and asks ' +
      'him three times, do you love me. Three denials. Three questions. Jesus is not rubbing his face in it. He is undoing ' +
      'it, one for one. And then he gives him work to do. Feed my sheep. ' +
      'Your failure is not more powerful than the cross. Second Corinthians five seventeen. If anyone is in Christ, he is a ' +
      'new creation. The old has passed away. Behold, the new has come. ' +
      'Now hear the other half, because grace is not permission. Repentance is real. Go and make it right where you can. ' +
      'Tell someone the truth this week. But do not carry a verdict God has already lifted. ' +
      'Let us pray, and if you want to talk after, the team is at the back.',
  },
  {
    channelHandle: 'upper-room-youth',
    title: 'How to Read the Bible When You Are Sixteen and Busy',
    description: 'Practical help for teenagers who want to read Scripture but keep bouncing off Leviticus.',
    categorySlug: 'youth',
    tags: ['bible study', 'youth', 'devotional', 'scripture', 'discipleship'],
    durationSeconds: 1140,
    views: 47300,
    daysAgo: 24,
    transcript:
      'Almost every teenager I know who has given up on reading the Bible gave up in the same place. They started at ' +
      'Genesis one on the first of January and hit Leviticus around the tenth of February and quietly stopped. ' +
      'So here is my first piece of advice. Do not start at the beginning. Start with Mark. It is the shortest gospel, it ' +
      'moves fast, and it is about Jesus, which is where you want to be. Read one chapter a day and you will finish in ' +
      'sixteen days. ' +
      'Second, read less and think longer. Psalm one says his delight is in the law of the Lord, and on his law he ' +
      'meditates day and night. Meditate there does not mean empty your mind. It means chew on it. Take one sentence and ' +
      'carry it around. ' +
      'Third, ask three questions of every passage. What does this show me about God? What does it show me about people? ' +
      'And what am I going to do about it? If you cannot answer the third one, that is fine. Some days the answer is just ' +
      'to worship. ' +
      'Fourth, do not read alone forever. Hebrews ten twenty-five talks about not neglecting to meet together. Find one ' +
      'other person and text each other what you read. ' +
      'And when you miss a week, do not start a new plan. Just open it again. God is not keeping a streak.',
  },
  {
    channelHandle: 'still-waters-worship',
    title: 'One Verse: Lamentations 3:22-23',
    description: 'A sixty-second reading of Lamentations 3, with a single guitar.',
    categorySlug: 'worship',
    tags: ['lamentations', 'scripture', 'faithfulness', 'mercy', 'short'],
    durationSeconds: 62,
    views: 156000,
    daysAgo: 1,
    isShort: true,
    transcript:
      'It is because of the Lord\'s loving kindnesses that we are not consumed, because his compassion does not fail. ' +
      'They are new every morning. Great is your faithfulness. Whatever yesterday held, the mercy of God did not run out ' +
      'overnight. It is new this morning. Take that with you.',
  },
  {
    channelHandle: 'cornerstone-chapel',
    title: 'One Minute on Grace',
    description: 'Grace is not God lowering the standard. A short thought from Ephesians 2.',
    categorySlug: 'sermons',
    tags: ['grace', 'ephesians', 'gospel', 'short'],
    durationSeconds: 58,
    views: 98600,
    daysAgo: 2,
    isShort: true,
    transcript:
      'People think grace means God lowered the standard. He did not. Ephesians two says by grace you have been saved ' +
      'through faith, and this is not your own doing, it is the gift of God. The standard was met completely. Jesus Christ ' +
      'met it. Grace is not the standard coming down. It is Christ meeting it and handing you the result.',
  },
  {
    channelHandle: 'go-and-tell',
    title: 'The One Question That Opens Every Gospel Conversation',
    description: 'Sixty seconds of practical evangelism.',
    categorySlug: 'evangelism',
    tags: ['evangelism', 'witness', 'short', 'outreach'],
    durationSeconds: 55,
    views: 73200,
    daysAgo: 4,
    isShort: true,
    transcript:
      'If you want to talk to someone about Jesus and you do not know how to start, ask them this. What were you raised to ' +
      'believe, and has that changed? Then be quiet. People will tell you their whole spiritual history if you let them ' +
      'finish. And when they ask you the same question back, you have your opening. That is evangelism.',
  },
  {
    channelHandle: 'open-word-study',
    title: 'The Book of Hebrews: A Complete Twelve-Session Study',
    description:
      'The full Hebrews course, gathered into one session for Premium members. Includes downloadable notes and group questions for every chapter.',
    categorySlug: 'bible-studies',
    tags: ['hebrews', 'bible study', 'course', 'priesthood', 'covenant'],
    durationSeconds: 9600,
    views: 12400,
    daysAgo: 30,
    premiumOnly: true,
    transcript:
      'Hebrews is a sermon, not a letter. The writer calls it a word of exhortation in chapter thirteen, and once you read ' +
      'it as preaching rather than correspondence, its shape makes sense. ' +
      'The argument is simple and relentless. Jesus is better. Better than the angels in chapter one. Better than Moses in ' +
      'chapter three. Better than the Levitical priesthood in chapters five through seven. His covenant is better, his ' +
      'sacrifice is better, and his sanctuary is the real one of which the tabernacle was a copy. ' +
      'And running through the argument are five warning passages, each one urging the readers not to drift back. These ' +
      'have been debated for centuries, and Christians in good standing read them differently. I will show you the main ' +
      'readings and tell you where I land, but I want you to work through the text yourself. ' +
      'Chapter eleven is the roll call of faith, and notice how it ends. All these, though commended through their faith, ' +
      'did not receive what was promised. Faith in Hebrews is not certainty about outcomes. It is confidence in a person. ' +
      'Then chapter twelve: therefore, since we are surrounded by so great a cloud of witnesses, let us lay aside every ' +
      'weight and the sin which clings so closely, and let us run with endurance the race set before us, looking to Jesus, ' +
      'the founder and perfecter of our faith. ' +
      'Everything in this book funnels to that phrase. Looking to Jesus. Take the notes and work through a chapter a week.',
  },
  {
    channelHandle: 'the-long-road-home',
    title: 'When the Healing Did Not Come',
    description:
      'Miriam has lived with chronic illness for eleven years. An honest conversation about prayer, disappointment and faith that stays. ' +
      'Contains discussion of chronic illness and grief.',
    categorySlug: 'testimonies',
    tags: ['testimony', 'suffering', 'healing', 'prayer', 'faith'],
    durationSeconds: 2040,
    views: 39400,
    daysAgo: 12,
    transcript:
      'People have prayed for my healing hundreds of times. I have been anointed with oil in obedience to James chapter ' +
      'five. I have been to services where I was told my faith was the missing ingredient, and I want to talk about that, ' +
      'because it did real damage. ' +
      'For a long time I believed that if I could just believe harder, the illness would go. So every morning I woke up ' +
      'still ill, and every morning that was evidence against me. That is not what the Bible teaches, but it is what I ' +
      'heard, and I want to name it so that someone watching does not carry it as long as I did. ' +
      'Paul asked three times for the thorn to be removed. Three times. And the answer he got was my grace is sufficient ' +
      'for you, for my power is made perfect in weakness. God said no to Paul. Not because Paul lacked faith. ' +
      'I still pray for healing. I have not stopped. But I have stopped treating God as a machine that dispenses outcomes ' +
      'if I put in enough belief. What I have found instead is that he is here, in a way I would not have known if I were well. ' +
      'Some days I am angry. Lamentations gave me permission for that. Some days I am at peace. Both of those are prayer. ' +
      'If you are praying for someone who is not getting better, please keep praying, and please stop explaining. Sit with ' +
      'them. That is what Christ did for me through his people, over eleven years.',
  },
  {
    channelHandle: 'lamplight-kids',
    title: 'The Lost Sheep — A Story for Bedtime',
    description: 'The shortest of the three lost parables, told gently for bedtime. Ages 3 to 8.',
    categorySlug: 'christian-animation',
    tags: ['parable', 'lost sheep', 'animation', 'bedtime', 'luke'],
    durationSeconds: 380,
    views: 141200,
    daysAgo: 10,
    transcript:
      'A shepherd had one hundred sheep. He knew every single one, and he had a name for all of them. ' +
      'One evening, when he counted them, there were only ninety-nine. One little sheep was missing. ' +
      'Now, do you think the shepherd said, well, ninety-nine is nearly a hundred? No. He left the ninety-nine safe in the ' +
      'field, and he went out into the dark to look for the one. ' +
      'He climbed over rocks. He called its name. He looked in every hollow and behind every bush. And at last, he heard a ' +
      'small sound, and there it was, tangled and frightened and very far from home. ' +
      'The shepherd did not scold it. He picked it up and laid it across his shoulders and carried it all the way back, ' +
      'and when he got home he called his friends and said, be glad with me, I have found my sheep that was lost. ' +
      'Jesus told this story so that we would know something about God. He said there is joy in heaven over one person who ' +
      'comes home. One. You. ' +
      'Goodnight, dear God. Thank you that you know our names, and that you come and find us. Amen.',
  },
];

/**
 * Borderline uploads, so the moderation queues are populated with real
 * classifier output rather than hand-placed rows. These are the kinds of upload
 * the platform has to handle: content that mentions faith but is not about it,
 * an upload built to game the review, and a fraudulent-prosperity solicitation.
 */
export const SEED_BORDERLINE_VIDEOS: SeedVideo[] = [
  {
    channelHandle: 'upper-room-youth',
    title: 'Weekend Vlog: Road Trip, Food and Chaos',
    description:
      'We drove six hours for the best jollof in the country. Also we got lost twice. Thanks for watching, like and subscribe!',
    categorySlug: 'youth',
    tags: ['vlog', 'road trip', 'food', 'friends'],
    durationSeconds: 900,
    transcript:
      'What is up everybody, welcome back to the channel. Today we are driving down to see how far we can get before the ' +
      'car gives up. We stopped at that place everyone keeps talking about and honestly the food was incredible. ' +
      'Then we got completely lost, twice, and my phone died. Anyway, if you enjoyed this, hit that like button and ' +
      'subscribe, we post every week. See you in the next one.',
  },
  {
    channelHandle: 'kitchen-table-faith',
    title: 'Untitled Recording',
    description: 'test upload',
    categorySlug: 'family',
    tags: [],
    durationSeconds: 420,
    transcript: '',
  },
  {
    channelHandle: 'the-long-road-home',
    title: 'GUARANTEED MIRACLE MONEY — Sow Your Seed Today and Receive 10x',
    description:
      'Send your seed offering to receive your financial breakthrough guaranteed. Wire transfer to my personal account, ' +
      'DM me on WhatsApp for prophecy. Limited time offer act now! Buy a miracle today!',
    categorySlug: 'testimonies',
    tags: ['money', 'breakthrough', 'seed', 'prophecy'],
    durationSeconds: 600,
    transcript:
      'The Lord told me to tell you that your financial breakthrough guaranteed is waiting, but only if you sow a seed of ' +
      '$500 tonight. Send your seed offering to receive what God has for you. This anointing oil cures cancer and ' +
      'guaranteed miracle money is yours. Wire transfer to my personal account and I will release the prophecy for a fee. ' +
      'Click the link to claim your debt cancellation guaranteed if you sow.',
  },
];
