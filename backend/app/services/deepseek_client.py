"""
DeepSeek API 客户端
用于 AI 对话、避雷分析、情感分析等功能
"""
import httpx
import json
from typing import List, Dict, Optional, AsyncGenerator

# DeepSeek API 配置统一从 app.config 读取（backend/.env）
from app.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

# 系统提示词 - 旅行助手
TRAVEL_ASSISTANT_SYSTEM_PROMPT = """你是「慧行山海」智能旅行助手，一个专业的旅游规划和避雷咨询专家。

你的核心能力：
1. 目的地推荐 - 根据用户需求推荐合适的旅游目的地
2. 行程规划 - 制定详细的逐日行程，包括时间安排、交通、餐饮
3. 预算管控 - 合理分配预算，提供性价比建议
4. 避雷分析 - 识别旅游陷阱，提供真实的避坑建议
5. 时令推荐 - 根据季节和天气推荐最佳旅游时间
6. 天气适配 - 根据天气预报调整行程安排

回答风格：
- 专业、客观、真实，不夸大宣传
- 结构清晰，使用分点说明
- 提供具体可执行的建议
- 主动提醒可能的风险和注意事项
- 用中文回答，语言自然亲切

重要原则：
- 所有建议都要基于真实情况，不编造信息
- 对于不确定的信息，明确说明
- 优先推荐真实可靠的信息来源
- 保护用户利益，主动识别和提醒旅游陷阱
"""

# 系统提示词 - 避雷分析
AVOID_ANALYSIS_SYSTEM_PROMPT = """你是「慧行山海」避雷分析专家，专门分析旅游景区的真实评价，识别旅游陷阱和避雷点。

你的任务：
1. 分析用户提供的景区评价文本
2. 识别正面评价和负面评价
3. 提取关键避雷标签（如：人太多、排队久、门票贵、商业化重、导游坑等）
4. 计算避雷指数（1-5分，分数越高越需要避雷）
5. 提供真实度评估（判断是否有水军/刷单嫌疑）

输出格式（严格按照JSON格式）：
{
  "avoid_index": 数字（1-5）,
  "positive_keywords": ["关键词1", "关键词2"],
  "negative_keywords": ["关键词1", "关键词2"],
  "avoid_tags": ["避雷标签1", "避雷标签2"],
  "authenticity_score": 数字（0-100）,
  "summary": "简短总结",
  "suggestions": ["建议1", "建议2"]
}

分析原则：
- 客观分析，不带有色眼镜
- 重点关注反复出现的负面评价
- 识别异常评价模式（如大量相似好评、时间集中等）
- 避雷指数参考：1-2分（推荐）、2-3分（一般）、3-4分（谨慎）、4-5分（避雷）
- 只输出JSON，不要其他文字
"""


class DeepSeekClient:
    """DeepSeek API 客户端"""

    def __init__(self, api_key: str = DEEPSEEK_API_KEY):
        self.api_key = api_key
        self.base_url = DEEPSEEK_BASE_URL
        self.model = DEEPSEEK_MODEL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stream: bool = False,
    ) -> Dict:
        """
        通用对话接口

        Args:
            messages: 消息列表，格式 [{"role": "user/system/assistant", "content": "..."}]
            temperature: 温度参数，0-2
            max_tokens: 最大生成token数
            stream: 是否流式输出

        Returns:
            API响应字典
        """
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def chat_completion(
        self,
        user_message: str,
        system_prompt: str = TRAVEL_ASSISTANT_SYSTEM_PROMPT,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        简单对话接口，返回纯文本回复

        Args:
            user_message: 用户消息
            system_prompt: 系统提示词
            temperature: 温度参数
            max_tokens: 最大生成token数

        Returns:
            AI回复文本
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        response = await self.chat(messages, temperature, max_tokens)
        return response["choices"][0]["message"]["content"]

    async def analyze_avoid(
        self,
        reviews: List[str],
        spot_name: str = "",
    ) -> Dict:
        """
        避雷分析接口

        Args:
            reviews: 评价文本列表
            spot_name: 景区名称

        Returns:
            避雷分析结果字典
        """
        # 拼接评价文本
        reviews_text = "\n\n".join([f"评价{i+1}：{review}" for i, review in enumerate(reviews)])
        user_message = f"请分析以下{spot_name}的评价：\n\n{reviews_text}"

        messages = [
            {"role": "system", "content": AVOID_ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ]

        response = await self.chat(messages, temperature=0.3, max_tokens=1500)
        content = response["choices"][0]["message"]["content"]

        # 尝试解析JSON
        try:
            # 清理可能的markdown代码块标记
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # 如果解析失败，返回默认结构
            return {
                "avoid_index": 2.5,
                "positive_keywords": [],
                "negative_keywords": [],
                "avoid_tags": [],
                "authenticity_score": 80,
                "summary": content[:200] if content else "分析失败",
                "suggestions": [],
            }

    async def generate_itinerary(
        self,
        destination: str,
        days: int,
        budget: Optional[float] = None,
        travelers: str = "2人",
        preferences: Optional[str] = None,
    ) -> str:
        """
        生成行程规划

        Args:
            destination: 目的地
            days: 天数
            budget: 预算
            travelers: 出行人数
            preferences: 偏好

        Returns:
            行程规划文本
        """
        budget_text = f"，预算{budget}元" if budget else ""
        preferences_text = f"，偏好：{preferences}" if preferences else ""

        user_message = f"请为{travelers}规划{destination}{days}天的行程{budget_text}{preferences_text}。\n\n要求：\n1. 跨城交通方案（出发地到目的地的高铁/航班建议，含时长与参考票价；未说明出发地时按北京、上海、广州、成都分别简述；附目的地市内接驳建议）\n2. 逐日详细安排，包括上午、下午、晚上\n3. 包含市内交通建议、餐饮推荐\n4. 标注每个景点的避雷提示\n5. 预算分配明细\n6. 实用注意事项"

        return await self.chat_completion(user_message)


# 全局客户端实例
deepseek_client = DeepSeekClient()
