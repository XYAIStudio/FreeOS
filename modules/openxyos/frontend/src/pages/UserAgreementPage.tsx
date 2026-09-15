import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "../i18n";
import { EnglishUserAgreement } from "./LegalEnglishContent";

export default function UserAgreementPage() {
  const navigate = useNavigate();
  const { isEnglish } = useLocale();

  if (isEnglish) return <EnglishUserAgreement onBack={() => navigate("/auth")} />;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/auth")} className="flex items-center gap-2 text-sm text-text-muted hover:text-text mb-6">
          <ArrowLeft size={16} /> 返回
        </button>
        <h1 className="text-2xl font-bold text-text mb-6">用户服务协议</h1>
        <div className="prose prose-sm max-w-none text-text-muted space-y-4 text-sm leading-relaxed">
          <p className="text-text-muted">生效日期：2026年6月20日 | 最后更新：2026年6月20日</p>

          <h2 className="text-base font-semibold text-text mt-6">一、服务条款的接受</h2>
          <p>欢迎使用雄元智脑XYOS（以下简称"本平台"）。本平台由<strong>雄元科技有限公司</strong>（以下简称"我们"）开发并运营。在使用本平台之前，请仔细阅读本协议。<strong>当您点击"注册"按钮或实际使用本平台时，即表示您已阅读、理解并同意接受本协议全部条款的约束。</strong>如果您不同意本协议的任何条款，请勿注册或使用本平台。</p>
          <p>本协议构成您与我们之间具有法律约束力的合同。您确认具备完全的民事行为能力，如为法人或其他组织，您确认有权代表该主体签署并履行本协议。</p>

          <h2 className="text-base font-semibold text-text mt-6">二、服务内容</h2>
          <p>雄元智脑XYOS是雄元科技（以下简称"我们"）开发的人机共融智能体组织效能增强系统，为中小微企业提供以下服务：</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>AI数字员工管理与协作</li>
            <li>组织架构管理</li>
            <li>任务编排与执行</li>
            <li>知识库管理与沉淀</li>
            <li>目标、预算、绩效管理</li>
            <li>可配置的组织协作与治理能力</li>
            <li>其他经我们提供的相关服务</li>
          </ul>

          <h2 className="text-base font-semibold text-text mt-6">三、账号注册与管理</h2>
          <p>3.1 您在注册账号时应提供真实、准确、完整的个人信息，并及时更新。</p>
          <p>3.2 您应妥善保管账号及密码，因您个人原因导致的账号安全问题由您自行承担。</p>
          <p>3.3 您不得将账号转让、出借给他人使用。如发现未经授权使用您的账号，应立即通知我们。</p>
          <p>3.4 我们有权对违反本协议的账号采取限制、暂停或终止服务的措施。</p>

          <h2 className="text-base font-semibold text-text mt-6">四、用户行为规范</h2>
          <p>4.1 您应遵守中华人民共和国相关法律法规，不得利用本平台从事违法违规活动。</p>
          <p>4.2 您不得利用本平台发布、传播含有以下内容的信息：</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>违反国家法律法规的</li>
            <li>危害国家安全、泄露国家秘密的</li>
            <li>侵犯他人知识产权或其他合法权益的</li>
            <li>含有虚假、有害、威胁、侮辱、诽谤内容的</li>
            <li>含有计算机病毒或恶意代码的</li>
          </ul>

          <h2 className="text-base font-semibold text-text mt-6">五、知识产权</h2>
          <p>5.1 本平台的所有内容（包括但不限于软件、技术、文字、图片、数据等）的知识产权归雄元科技所有。</p>
          <p>5.2 您在使用本平台过程中产生的数据和内容，其知识产权归您所有。您授权我们在提供服务范围内使用这些数据。</p>

          <h2 className="text-base font-semibold text-text mt-6">六、服务费用与退款</h2>
          <p>6.1 本平台提供免费套餐及付费套餐。免费套餐功能受限制，具体以平台公示为准。</p>
          <p>6.2 付费套餐按订阅周期收费（月付或年付）。您在购买时即确认所选的套餐方案和费用。</p>
          <p>6.3 <strong>退款政策</strong>：付费后7日内，如未实际使用本平台核心功能，可申请全额退款。超过7日或已实际使用核心功能的，按未使用天数比例退款，退款金额 = 实付金额 ×（剩余天数 ÷ 总天数）。年付用户提前解约的，按已使用月数扣除费用后退还余额。</p>
          <p>6.4 因违反本协议导致账号被终止的，已付费用不予退还。</p>
          <p>6.5 我们保留根据经营需要调整价格的权利，价格调整前已购买的套餐不受影响。</p>

          <h2 className="text-base font-semibold text-text mt-7">七、AI服务特别条款</h2>
          <p>7.1 本平台集成了AI对话、AI内容生成、AI合同解析等功能（以下统称"AI功能"）。AI功能由第三方AI服务商提供底层技术支持。</p>
          <p>7.2 <strong>AI生成内容仅供参考</strong>，不构成法律、财务、医疗或其他专业建议。您应自行判断并承担依据AI生成内容做出决策的风险。</p>
          <p>7.3 我们不对AI生成内容的准确性、完整性、时效性做任何保证。对于因依赖AI生成内容而导致的任何损失，我们不承担责任。</p>
          <p>7.4 您通过本平台上传的文档和输入的内容，仅用于向您提供AI功能的必要处理。我们不会将您的数据用于训练AI模型，以保护您的商业秘密。</p>

          <h2 className="text-base font-semibold text-text mt-7">八、数据与隐私</h2>
          <p>8.1 您在使用本平台过程中产生的数据（包括组织架构、员工信息、任务数据、聊天记录、上传文档等），其所有权归属您。</p>
          <p>8.2 我们依据《隐私政策》收集、使用、存储和保护您的数据。使用本平台即视为您已阅读并同意《隐私政策》。</p>
          <p>8.3 <strong>数据可携带权</strong>：您可随时导出您的数据。如您终止使用本平台，我们将在90天内删除您的全部数据（法律法规另有规定的除外）。</p>

          <h2 className="text-base font-semibold text-text mt-7">九、免责声明</h2>
          <p>9.1 因不可抗力、网络故障、电力中断、计算机病毒攻击、政府行为等不可归责于我们的原因导致的服务中断或数据丢失，我们不承担责任，但会在合理时间内尽力恢复服务。</p>
          <p>9.2 我们不对因您使用或无法使用本平台而产生的任何间接损失（包括利润损失、商誉损失、数据丢失等）承担赔偿责任。</p>
          <p>9.3 在任何情况下，我们对您的赔偿责任总额不超过您在我们已支付的最近12个月服务费用总额。</p>

          <h2 className="text-base font-semibold text-text mt-6">十、协议的变更与终止</h2>
          <p>10.1 我们可能根据法律法规变化或业务需要不时修改本协议。修改后的协议将在平台公示，重大变更将通过站内通知或邮件告知。</p>
          <p>10.2 如您不同意修改，可在变更生效前停止使用并注销账号。变更生效后继续使用即视为同意修改后的协议。</p>
          <p>10.3 您可以随时停止使用本平台并申请注销账号。注销后，您的数据将按照隐私政策处理。</p>

          <h2 className="text-base font-semibold text-text mt-6">十一、争议解决</h2>
          <p>11.1 本协议的订立、执行、解释及争议解决均适用中华人民共和国法律。</p>
          <p>11.2 因本协议引起的或与本协议有关的任何争议，双方应首先友好协商解决。协商不成的，任何一方均可向<strong>雄元科技有限公司住所地</strong>有管辖权的人民法院提起诉讼。</p>

          <h2 className="text-base font-semibold text-text mt-6">十二、联系方式</h2>
          <p>如对本协议有任何疑问、意见或建议，请通过以下方式联系我们：</p>
          <p>公司名称：雄元科技有限公司</p>
          <p>联系邮箱：support@xiongyuan.ai</p>
          <p>我们将在收到您的来信后7个工作日内回复。</p>
        </div>
      </div>
    </div>
  );
}
