import { ArrowLeft } from "lucide-react";

type LegalPageProps = { onBack: () => void };

function LegalLayout({ title, children, onBack }: LegalPageProps & { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-text-muted hover:text-text mb-6">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-2xl font-bold text-text mb-6">{title}</h1>
        <div className="prose prose-sm max-w-none text-text-muted space-y-4 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => <h2 className="text-base font-semibold text-text mt-6">{children}</h2>;
const List = ({ children }: { children: React.ReactNode }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>;

export function EnglishUserAgreement({ onBack }: LegalPageProps) {
  return (
    <LegalLayout title="Terms of Service" onBack={onBack}>
      <p>Effective date: June 20, 2026 | Last updated: June 20, 2026</p>
      <Heading>1. Acceptance of Terms</Heading>
      <p>Welcome to Xiongyuan Intelligent Brain XYOS (the “Platform”). The Platform is developed and operated by <strong>Xiongyuan Technology Co., Ltd.</strong> (“we”, “us” or “our”). Please read these Terms carefully before using the Platform. <strong>By clicking “Sign up” or using the Platform, you confirm that you have read, understood and agreed to be bound by all terms of this agreement.</strong> If you do not agree, do not register for or use the Platform.</p>
      <p>These Terms form a legally binding agreement between you and us. You confirm that you have full civil capacity or, when acting for an entity, authority to bind that entity.</p>
      <Heading>2. Services</Heading>
      <p>XYOS is a human–AI collaborative organization-effectiveness system developed by Xiongyuan Technology for small and medium-sized businesses. Services include:</p>
      <List><li>AI digital employee management and collaboration</li><li>Organization structure management</li><li>Task orchestration and execution</li><li>Knowledge-base management</li><li>Goals, budgets and performance management</li><li>Configurable collaboration and governance capabilities</li><li>Other related services we provide</li></List>
      <Heading>3. Account Registration and Management</Heading>
      <p>3.1 You must provide true, accurate and complete registration information and keep it current.</p><p>3.2 You are responsible for safeguarding your account and password and for account-security issues caused by you.</p><p>3.3 You may not transfer or lend your account. Notify us immediately of any unauthorized use.</p><p>3.4 We may restrict, suspend or terminate accounts that violate these Terms.</p>
      <Heading>4. Acceptable Use</Heading>
      <p>4.1 You must comply with applicable laws and regulations and may not use the Platform for unlawful activities.</p><p>4.2 You may not publish or distribute information that:</p>
      <List><li>violates applicable laws or regulations</li><li>endangers national security or discloses state secrets</li><li>infringes intellectual property or other lawful rights</li><li>is false, harmful, threatening, insulting or defamatory</li><li>contains computer viruses or malicious code</li></List>
      <Heading>5. Intellectual Property</Heading>
      <p>5.1 Intellectual property in Platform content, including software, technology, text, images and data, belongs to Xiongyuan Technology.</p><p>5.2 You retain intellectual property in data and content you create while using the Platform. You authorize us to use it only as necessary to provide the Services.</p>
      <Heading>6. Fees and Refunds</Heading>
      <p>6.1 The Platform offers free and paid plans. Free-plan capabilities are limited as published by the Platform.</p><p>6.2 Paid plans are billed monthly or annually. By purchasing, you confirm the selected plan and fee.</p><p>6.3 <strong>Refund policy:</strong> within seven days after payment, if core Platform functions have not been used, you may request a full refund. After seven days or after use of core functions, a proportional refund may be available: amount paid × (remaining days ÷ total days). For annual plans terminated early, the balance is returned after deducting fees for months used.</p><p>6.4 Fees are non-refundable when termination results from your breach of these Terms.</p><p>6.5 We may adjust prices for future purchases; purchased plans are unaffected.</p>
      <Heading>7. AI Services</Heading>
      <p>7.1 The Platform includes AI chat, content generation and contract analysis (collectively, “AI Features”). Underlying technology may be supplied by third-party AI providers.</p><p>7.2 <strong>AI-generated content is for reference only</strong> and is not legal, financial, medical or other professional advice. You must independently assess it and bear the risk of decisions based on it.</p><p>7.3 We make no warranty regarding the accuracy, completeness or timeliness of AI-generated content and are not liable for losses arising from reliance on it.</p><p>7.4 Documents and inputs you upload are processed only as necessary to provide AI Features. We do not use your data to train AI models.</p>
      <Heading>8. Data and Privacy</Heading>
      <p>8.1 Data produced through the Platform, including organization structures, employee information, tasks, chat records and uploaded documents, belongs to you.</p><p>8.2 We collect, use, store and protect your data under the Privacy Policy. By using the Platform, you acknowledge the Privacy Policy.</p><p>8.3 <strong>Data portability:</strong> you may export your data at any time. If you stop using the Platform, we will delete your data within 90 days except where laws require otherwise.</p>
      <Heading>9. Disclaimers and Limits</Heading>
      <p>9.1 We are not liable for service interruption or data loss caused by force majeure, network failures, power interruptions, computer-virus attacks, government actions or other causes not attributable to us, but will use reasonable efforts to restore service.</p><p>9.2 We are not liable for indirect losses, including lost profits, goodwill or data.</p><p>9.3 Our total liability will not exceed the total service fees you paid to us in the preceding 12 months.</p>
      <Heading>10. Changes and Termination</Heading>
      <p>10.1 We may modify these Terms to reflect legal or business changes. Revised Terms will be posted on the Platform, with material changes notified in-platform or by email.</p><p>10.2 If you do not agree to a change, stop using the Platform and close your account before it takes effect. Continued use after the effective date means acceptance.</p><p>10.3 You may stop using the Platform and request account closure at any time. Data will be handled under the Privacy Policy.</p>
      <Heading>11. Governing Law and Disputes</Heading>
      <p>11.1 These Terms are governed by the laws of the People’s Republic of China.</p><p>11.2 Disputes should first be resolved through friendly consultation. If unresolved, either party may bring an action before a people’s court with jurisdiction at the domicile of Xiongyuan Technology Co., Ltd.</p>
      <Heading>12. Contact</Heading>
      <p>For questions, comments or suggestions, contact Xiongyuan Technology Co., Ltd. at support@xiongyuan.ai. We will reply within seven business days after receiving your message.</p>
    </LegalLayout>
  );
}

export function EnglishPrivacyPolicy({ onBack }: LegalPageProps) {
  return (
    <LegalLayout title="Privacy Policy" onBack={onBack}>
      <p>Effective date: January 1, 2023 | Last updated: June 14, 2026</p>
      <Heading>1. Introduction</Heading><p>Xiongyuan Technology (“we”, “us” or “our”) values your privacy. This Privacy Policy explains how we collect, use, store, share and protect personal information before you use Xiongyuan Intelligent Brain XYOS (the “Platform”).</p>
      <Heading>2. Information We Collect</Heading><p>We may collect:</p><p><strong>2.1 Information you provide:</strong></p><List><li>Registration information: email address, nickname and password</li><li>Business information: company name, organization structure and department information</li><li>Usage content: task data, chat records and knowledge-base documents</li></List><p><strong>2.2 Information collected automatically:</strong></p><List><li>Device information: browser type, operating system and device identifiers</li><li>Log information: access time, IP address and activity records</li><li>Usage data: feature-use frequency and token consumption</li></List>
      <Heading>3. How We Use Information</Heading><p>We use collected information to:</p><List><li>provide, maintain and improve Services</li><li>process requests and transactions</li><li>send service notices and updates</li><li>prevent fraud and security risks</li><li>analyze data to improve the user experience</li><li>comply with legal requirements</li></List>
      <Heading>4. Storage and Security</Heading><p>4.1 Your data is stored in secure server environments. We use encryption to protect data in transit and at rest.</p><p>4.2 We use multi-tenant data isolation to separate data between businesses.</p><p>4.3 We take reasonable safeguards, but no method of protection can guarantee absolute security.</p>
      <Heading>5. Information Sharing</Heading><p>We do not share personal information with third parties except where:</p><List><li>you give explicit consent</li><li>sharing is necessary to provide Services, such as with AI model providers</li><li>required by law or a lawful government request</li><li>needed to protect the lawful rights and interests of Xiongyuan Technology or the public</li></List>
      <Heading>6. Cookies and Similar Technologies</Heading><p>We use cookies and similar technologies to maintain sign-in status, remember preferences and analyze service use. You may manage cookies through browser settings.</p>
      <Heading>7. Your Rights</Heading><p>You may access, correct or delete personal information; withdraw consent; obtain a copy of your personal information; and close your account. To exercise these rights, contact us using the details below.</p>
      <Heading>8. Protection of Minors</Heading><p>The Platform is not directed to individuals under 18. If we learn that we have collected a minor’s personal information, we will delete it as soon as possible.</p>
      <Heading>9. Policy Updates</Heading><p>We may update this Privacy Policy from time to time. The updated version will be posted on the Platform and apply from its effective date. We will notify you through the Platform or by email of material changes.</p>
      <Heading>10. Contact Us</Heading><p>For questions, comments or suggestions about this Privacy Policy, email privacy@xiongyuan.ai or contact us at Xiongyuan Technology, Beijing.</p>
    </LegalLayout>
  );
}
