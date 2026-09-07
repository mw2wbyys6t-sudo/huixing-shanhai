"""
美团开放平台 API 客户端
用于获取景区评价、POI信息等数据
"""
import httpx
from typing import List, Dict, Optional

# 美团开放平台配置统一从 app.config 读取（backend/.env）
from app.config import MEITUAN_ACCESS_TOKEN, MEITUAN_BASE_URL


class MeituanClient:
    """美团开放平台 API 客户端"""

    def __init__(self, access_token: str = MEITUAN_ACCESS_TOKEN):
        self.access_token = access_token
        self.base_url = MEITUAN_BASE_URL
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def search_poi(self, keyword: str, city: str = "") -> List[Dict]:
        """
        搜索POI（景点/商家）

        Args:
            keyword: 搜索关键词
            city: 城市名称

        Returns:
            POI列表
        """
        # 美团开放平台POI搜索接口（具体端点需根据实际API文档调整）
        url = f"{self.base_url}/openapi/poi/search"
        params = {
            "keyword": keyword,
            "city": city,
            "access_token": self.access_token,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=self.headers)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data", {}).get("pois", [])
                return []
        except Exception:
            return []

    async def get_reviews(self, poi_id: str, page: int = 1, page_size: int = 20) -> Dict:
        """
        获取商家/景点评价

        Args:
            poi_id: POI ID
            page: 页码
            page_size: 每页数量

        Returns:
            评价数据
        """
        url = f"{self.base_url}/openapi/review/list"
        params = {
            "poi_id": poi_id,
            "page": page,
            "page_size": page_size,
            "access_token": self.access_token,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=self.headers)
                if response.status_code == 200:
                    return response.json()
                return {"reviews": [], "total": 0}
        except Exception:
            return {"reviews": [], "total": 0}

    async def get_poi_detail(self, poi_id: str) -> Optional[Dict]:
        """
        获取POI详情

        Args:
            poi_id: POI ID

        Returns:
            POI详情
        """
        url = f"{self.base_url}/openapi/poi/detail"
        params = {
            "poi_id": poi_id,
            "access_token": self.access_token,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=self.headers)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data")
                return None
        except Exception:
            return None


# 全局客户端实例
meituan_client = MeituanClient()
