import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { useConfig } from '@/context/ConfigContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { RayBackdrop } from '@/components/brand/Logo';
import { Card } from '@/components/ui';
import { LinkButton } from '@/components/ui/Button';
import { IconShield } from '@/components/ui/Icons';

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="ft-prose mx-auto max-w-2xl space-y-6 pb-12">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  );
}

export function AboutPage() {
  const { brand, moderation } = useConfig();
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api<{ videos: number; channels: number; members: number; watchHours: number }>('/system/stats'),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <section className="relative mb-10 overflow-hidden rounded-3xl bg-dawn px-6 py-14 text-center text-cream sm:px-12">
        <RayBackdrop className="text-gold" />
        <div className="relative">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{brand.motto}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/75">{brand.description}</p>
          <p className="mt-6 text-sm text-gold-soft">{brand.supportingMotto}</p>
        </div>
      </section>

      {stats ? (
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Videos', formatCount(stats.videos)],
            ['Channels', formatCount(stats.channels)],
            ['Members', formatCount(stats.members)],
            ['Watch hours', formatCount(stats.watchHours)],
          ].map(([label, value]) => (
            <div key={label} className="ft-card p-4 text-center">
              <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-0.5 text-xs ft-muted">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Prose>
        <Section title="Why this exists">
          <p>
            Christians upload an enormous amount of video, and most of it lives on platforms built for something else
            entirely. A sermon sits next to whatever the algorithm decides comes after it. A children's Bible story is one
            autoplay away from content no parent would choose. {brand.name} exists because that is a poor home for the
            Gospel, and because a dedicated place is a better one.
          </p>
        </Section>

        <Section title="What we host">
          <p>
            Sermons, Bible teaching, worship, Christian music, prayer, testimonies, documentaries, animation for children,
            youth and family discipleship, evangelism and apologetics, missionary reports, and Christian conversation.
            Nothing else. Read the{' '}
            <Link to="/content-policy">Christian Content Policy</Link> for what that means in practice.
          </p>
        </Section>

        <Section title="How review works">
          <p>
            Every upload goes through the same pipeline. We read the video, extract audio, produce a transcript where a
            transcription service is available, and examine the title, description, tags, thumbnail and sampled frames.
            Two questions are asked: is this Christ-centred, and is it safe?
          </p>
          <p>
            That produces one of four outcomes. <strong>Approved</strong> means clearly Christian and clearly safe.{' '}
            <strong>Restricted</strong> means genuinely Christian, but covering subject matter that warrants an age gate or
            a content notice. <strong>Human review</strong> means the classifier was not confident, which happens often and
            is the intended behaviour. <strong>Rejected</strong> means a clear breach.
          </p>
          <p>
            A human moderator has the final say on everything. If your video was rejected and you believe that is wrong,
            you can appeal once and a person will read it.
          </p>
          <Card className="!bg-verified/[0.07] ring-verified/25">
            <div className="flex gap-3">
              <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-verified" />
              <p className="text-sm leading-relaxed">
                <strong>What the classifier will not do:</strong> it does not judge between Christian denominations or
                traditions, and disagreement with a particular tradition's distinctives is never a reason for rejection.
                Catholic, Orthodox, Protestant, Pentecostal, Reformed, Baptist, Methodist, Anabaptist and other historic
                Christian traditions are equally welcome here.
              </p>
            </div>
          </Card>
          <p className="text-sm ft-muted">{moderation.note}</p>
        </Section>

        <Section title="How we do not work">
          <p>
            {brand.name} does not pay creators based on subscriber count or views. There is no threshold to cross, no
            monetisation tier, and no earnings figure in the creator dashboard. Ten subscribers and ten thousand generate
            exactly the same amount from this platform: nothing.
          </p>
          <p>
            That is a deliberate design decision rather than an oversight. Paying by audience size shapes what people make
            — it rewards the thumbnail, the hook and the upload cadence over the teaching. If creator support is
            introduced later it will be separate, optional and clearly explained, and it will not be automatic.
          </p>
        </Section>

        <Section title="Premium">
          <p>
            Premium pays for storage, bandwidth and the review process. It gives subscribers ad-free viewing, background
            playback, offline downloads on mobile, higher-quality playback and access to some long-form teaching. It is not
            a payout pool. <Link to="/premium">More about Premium</Link>.
          </p>
        </Section>
      </Prose>
    </div>
  );
}

export function ContentPolicyPage() {
  const { brand } = useConfig();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Policy"
        title="Christian Content Policy"
        description={`What ${brand.name} hosts, what it does not, and how we decide.`}
      />

      <Prose>
        <Section title="The rule">
          <p>
            Every video on {brand.name} must be Christ-centred. That means its primary purpose is Christian teaching,
            preaching, worship, prayer, testimony, evangelism, apologetics, Christian education, Christian music, Christian
            storytelling, missions, or Christian family and youth discipleship.
          </p>
          <p>
            Using Christian vocabulary is not the same as being Christian content. A video that mentions God while being
            about something else entirely does not belong here.
          </p>
        </Section>

        <Section title="What is welcome">
          <ul className="list-disc space-y-1 pl-5">
            {[
              'Bible teaching and expository preaching',
              'Sermons and Sunday services',
              'Worship, hymns, psalms and Christian music',
              'Prayer meetings and guided prayer',
              'Testimonies of what God has done',
              'Christian documentaries and church history',
              'Christian education and theology courses',
              'Animated Bible stories and children’s content',
              'Evangelism, outreach and apologetics',
              'Christian conferences and events',
              'Marriage, parenting and family discipleship',
              'Missionary stories and reports from the field',
              'Christian conversation, interviews and podcasts',
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="What is not permitted">
          <ul className="list-disc space-y-1 pl-5">
            {[
              'Non-Christian entertainment presented as Christian content',
              'Pornographic or sexually explicit material',
              'Extremist content, or content that promotes violence',
              'Fraud, scams, and fraudulent religious claims — including guaranteed-miracle and seed-for-money solicitation',
              'Dangerous or illegal activity',
              'Hate, harassment, or content that demeans people',
              'Spam and repetitive low-value uploads',
              'Malware, phishing and deceptive links',
              'Impersonation of a person, ministry or organisation',
              'Content designed to deceive viewers',
              'Uploads constructed to bypass our review process',
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="Denominations and theological difference">
          <p>
            Christianity contains many traditions with real and long-standing disagreements. {brand.name} does not
            adjudicate between them. Our review does not favour one tradition, and no video is rejected for holding a
            position another tradition would dispute.
          </p>
          <p>
            The same applies in the comments. Theological disagreement, including sharp disagreement, is permitted and
            expected. What is not permitted is personal attack, harassment or abuse — the distinction is between arguing
            with what someone said and demeaning who they are.
          </p>
        </Section>

        <Section title="Apologetics and difficult subjects">
          <p>
            Answering objections to Christianity is Christian content, even when doing so requires quoting the objection at
            length. Likewise, Scripture itself contains violence, sexual sin and profound suffering, and teaching those
            passages faithfully is not a policy breach.
          </p>
          <p>
            Where a video handles heavy subject matter — suicide, abuse, addiction, graphic persecution — we may apply an
            age restriction and a content notice rather than removing it. The video stays; viewers are simply told what
            they are about to watch.
          </p>
        </Section>

        <Section title="If your video is rejected">
          <p>
            You will be told which rule applies. We deliberately do not describe how detection works, because that
            information would be used to work around it. You may appeal a decision once, and a human moderator will read
            your explanation alongside the video. Repeated automated appeals are not permitted.
          </p>
          <p>
            Serious breaches — sexual content, hate, fraud, dangerous content, and deliberate attempts to bypass review —
            add a strike to your account. Accumulated strikes lead to suspension.
          </p>
        </Section>

        <Section title="Reporting">
          <p>
            If you see something that does not belong here, report it. Reports go to a human moderator. Please do not
            report a video simply because you disagree with it — that is not what the system is for, and it slows down the
            reports that matter.
          </p>
        </Section>
      </Prose>
    </div>
  );
}

export function PrivacyPage() {
  const { brand } = useConfig();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Policy" title="Privacy Policy" description="What we collect, why, and what you can do about it." />
      <Prose>
        <Section title="What we collect">
          <p>
            Your account details (email, display name, username, optional country and date of birth), what you watch and
            search for, what you like and save, your subscriptions, and anything you upload or post. If you subscribe to
            Premium, we store the subscription's status and identifiers from our payment provider.
          </p>
        </Section>
        <Section title="What we never do">
          <p>
            We do not store your card details. Payment information is handled entirely by our payment provider and never
            reaches {brand.name}'s servers or database.
          </p>
          <p>
            Your email address is never shown publicly unless you explicitly choose to share it on your profile. IP
            addresses are hashed before they are recorded in audit logs, so the raw address is not retained.
          </p>
        </Section>
        <Section title="Why we use your watch history">
          <p>
            Watch history, likes, subscriptions and searches feed the recommendation engine. That is their only purpose
            here. You can clear your history at any time from <Link to="/history">Watch history</Link>, which resets your
            recommendations.
          </p>
        </Section>
        <Section title="Your rights">
          <p>
            You can download everything we hold about you as a JSON file from{' '}
            <Link to="/settings/privacy">Privacy &amp; security</Link>, and you can close your account from the same page.
            Closing an account scrubs your personal details and unpublishes your videos.
          </p>
        </Section>
        <Section title="Security">
          <p>
            Sessions are held in an httpOnly cookie that scripts cannot read, and every session can be revoked
            individually from your settings. Passwords are hashed with bcrypt. Administrative and moderation actions are
            recorded in an append-only audit log.
          </p>
        </Section>
      </Prose>
    </div>
  );
}

export function TermsPage() {
  const { brand } = useConfig();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Policy" title="Terms & Community Guidelines" />
      <Prose>
        <Section title="Using FaithTube">
          <p>
            You need an account to upload, comment, subscribe or save. You are responsible for what you post, and you must
            have the rights to any material you upload.
          </p>
        </Section>
        <Section title="Content">
          <p>
            All uploads are subject to the <Link to="/content-policy">Christian Content Policy</Link> and must pass review
            before publication. {brand.name} may remove content that breaches the policy and may suspend accounts that
            repeatedly do so.
          </p>
        </Section>
        <Section title="Community conduct">
          <ul className="list-disc space-y-1 pl-5">
            <li>Disagree freely and charitably. Argue with the position, not the person.</li>
            <li>No harassment, personal attacks, or content that demeans anyone.</li>
            <li>No spam, solicitation, or links to schemes.</li>
            <li>No impersonation of a person, church or ministry.</li>
            <li>Do not attempt to bypass moderation.</li>
          </ul>
        </Section>
        <Section title="Creator terms">
          <p>
            You keep ownership of what you upload. You grant {brand.name} the licence needed to host, transcode and show
            it on the platform. {brand.name} does not pay creators based on subscriber count or views, and no such
            entitlement is created by using the platform.
          </p>
        </Section>
        <Section title="Ending your use">
          <p>
            You may close your account at any time. We may suspend or close an account that repeatedly breaches these terms
            or the content policy, and we will tell you why when we do.
          </p>
        </Section>
      </Prose>
    </div>
  );
}

export function HelpPage() {
  const { brand } = useConfig();
  const topics = [
    {
      question: 'How long does review take?',
      answer:
        'Usually a minute or two. If the automated review is not confident, it goes to a human moderator, which can take longer depending on the queue. You will be notified either way.',
    },
    {
      question: 'My video was sent to human review. Did I do something wrong?',
      answer:
        'No. It most often means there was not enough usable text to judge the content — a video with no transcript and a short description, for example. It is not a judgement against you.',
    },
    {
      question: 'My video was rejected and I think that is wrong.',
      answer:
        'Open it in the Creator Studio and use Appeal. Explain what you believe the review got wrong. A person will read your explanation alongside your video. You can appeal a decision once.',
    },
    {
      question: 'How do I start a channel?',
      answer: 'Go to Upload. If you do not have a channel yet, you will be asked to create one first. It takes a minute.',
    },
    {
      question: 'How much does FaithTube pay creators?',
      answer:
        'Nothing, deliberately. There is no payment based on subscriber count or views, and no monetisation threshold. See the About page for why.',
    },
    {
      question: 'Why can I not comment?',
      answer:
        'Either you are not signed in, comments are turned off for that video, or your comment was held for review because it matched a spam or abuse pattern. Disagreement itself is never held.',
    },
    {
      question: 'Can I download videos to watch offline?',
      answer: 'Yes, with Premium, in the mobile app. Downloads are stored on your device.',
    },
    {
      question: 'How do I report something?',
      answer:
        'Use the Report button on any video, comment or channel. Reports go to a human moderator. Please do not report content simply because you disagree with it.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Support" title="Help" description={`Common questions about using ${brand.name}.`} />

      <div className="space-y-3">
        {topics.map((topic) => (
          <details key={topic.question} className="ft-card group p-0">
            <summary className="cursor-pointer list-none px-5 py-4 font-medium marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {topic.question}
                <span className="shrink-0 text-gold transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </span>
            </summary>
            <p className="border-t border-navy/8 px-5 py-4 text-sm leading-relaxed ft-muted dark:border-white/8">{topic.answer}</p>
          </details>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-semibold">Still stuck?</h2>
        <p className="mt-1.5 text-sm ft-muted">
          Get in touch at <a href={`mailto:${brand.supportEmail}`} className="text-gold-deep underline dark:text-gold-soft">{brand.supportEmail}</a>, or read the{' '}
          <Link to="/content-policy" className="text-gold-deep underline dark:text-gold-soft">Content Policy</Link> if your question is about a review decision.
        </p>
      </Card>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 text-gold" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <path d="M32 8v10M27 13h10" strokeLinecap="round" />
        <path d="M16 54V34a16 16 0 0 1 32 0v20Z" strokeLinejoin="round" />
      </svg>
      <h1 className="mt-6 font-display text-2xl font-semibold">This page does not exist</h1>
      <p className="mt-2 text-sm ft-muted">
        The link may be broken, or the video may have been removed while it was under review.
      </p>
      <LinkButton to="/" variant="gold" className="mt-6">
        Back to home
      </LinkButton>
    </div>
  );
}

export function ProfilePage() {
  return null;
}
