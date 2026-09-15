import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "../i18n";
import { EnglishPrivacyPolicy } from "./LegalEnglishContent";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const { isEnglish } = useLocale();

  if (isEnglish) return <EnglishPrivacyPolicy onBack={() => navigate("/auth")} />;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/auth")} className="flex items-center gap-2 text-sm text-text-muted hover:text-text mb-6">
          <ArrowLeft size={16} /> 返回
        </button>
        <h1 className="text-2xl font-bold text-text mb-6">隐私政策</h1>
        <div className="prose prose-sm max-w-none text-text-muted space-y-4 text-sm leading-relaxed">
          <p>生效日期：2023年1月1日 | 最后更新：2026年6月14日</p>

          <h2 className="text-base font-semibold text-text mt-6">一、引言</h2>
          <p>雄元科技（以下简称"我们"）非常重视您的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储、共享和保护您的个人信息。请在使用雄元智脑XYOS（以下简称"本平台"）服务前仔细阅读本政策。</p>

          <h2 className="text-base font-semibold text-text mt-6">二、信息收集</h2>
          <p>我们可能收集以下类型的信息：</p>
          <p><strong>2.1 您主动提供的信息：</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li>注册信息：邮箱地址、昵称、密码</li>
            <li>企业信息：公司名称、组织架构、部门信息</li>
            <li>使用内容：任务数据、聊天记录、知识库文档</li>
          </ul>
          <p><strong>2.2 自动收集的信息：</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li>设备信息：浏览器类型、操作系统、设备标识</li>
            <li>日志信息：访问时间、IP地址、操作记录</li>
            <li>使用数据：功能使用频率、Token消耗量</li>
          </ul>

          <h2 className="text-base font-semibold text-text mt-6">三、信息使用</h2>
          <p>我们收集的信息将用于以下目的：</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>提供、维护和改进我们的服务</li>
            <li>处理您的请求和交易</li>
            <li>发送服务通知和更新</li>
            <li>防范欺诈和安全风险</li>
            <li>进行数据分析以改善用户体验</li>
            <li>遵守法律法规要求</li>
          </ul>

          <h2 className="text-base font-semibold text-text mt-6">四、信息存储与安全</h2>
          <p>4.1 您的数据存储在安全的服务器环境中，我们采用加密技术保护数据传输和存储安全。</p>
          <p>4.2 我们实施多租户数据隔离机制，确保不同企业的数据相互隔离。</p>
          <p>4.3 我们采用合理的安全措施保护您的个人信息，但无法保证绝对安全。</p>

          <h2 className="text-base font-semibold text-text mt-6">五、信息共享</h2>
          <p>除以下情况外，我们不会与第三方共享您的个人信息：</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>获得您的明确同意</li>
            <li>为提供服务所必需（如AI模型服务提供商）</li>
            <li>遵守法律法规或政府部门的合法要求</li>
            <li>保护雄元科技或公众的合法权益</li>
          </ul>

          <h2 className="text-base font-semibold text-text mt-6">六、Cookie和类似技术</h2>
          <p>我们使用Cookie和类似技术来维持您的登录状态、记住您的偏好设置和分析服务使用情况。您可以通过浏览器设置管理Cookie。</p>

          <h2 className="text-base font-semibold text-text mt-6">七、您的权利</h2>
          <p>您有权：</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>访问、更正或删除您的个人信息</li>
            <li>撤回您的同意</li>
            <li>获取您的个人信息副本</li>
            <li>注销您的账号</li>
          </ul>
          <p>如需行使上述权利，请通过本政策末尾的联系方式与我们联系。</p>

          <h2 className="text-base font-semibold text-text mt-6">八、未成年人保护</h2>
          <p>本平台不面向未满18周岁的未成年人提供服务。如我们发现已收集未成年人的个人信息，将尽快删除。</p>

          <h2 className="text-base font-semibold text-text mt-6">九、政策更新</h2>
          <p>我们可能不时更新本隐私政策。更新后的政策将在平台上公布，并在生效日期开始适用。重大变更时，我们会通过平台通知或邮件方式告知您。</p>

          <h2 className="text-base font-semibold text-text mt-6">十、联系我们</h2>
          <p>如您对本隐私政策有任何疑问、意见或建议，请通过以下方式联系我们：</p>
          <p>邮箱：privacy@xiongyuan.ai</p>
          <p>地址：北京市雄元科技</p>
        </div>
      </div>
    </div>
  );
}
