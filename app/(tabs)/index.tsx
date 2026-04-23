import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

type FavoritePlace = {
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  sourceUrl: string;
};

const mockCoordinates: Record<string, { latitude: number; longitude: number }> = {
  "Shibuya Sky": { latitude: 35.6595, longitude: 139.7005 },
  "淺草寺": { latitude: 35.7148, longitude: 139.7967 },
  "東京車站": { latitude: 35.6812, longitude: 139.7671 },
  "大阪城": { latitude: 34.6873, longitude: 135.5262 },
  "黑門市場": { latitude: 34.6654, longitude: 135.5063 },
  "心齋橋": { latitude: 34.6751, longitude: 135.5016 },
  "清水寺": { latitude: 34.9949, longitude: 135.7850 },
  "伏見稻荷大社": { latitude: 34.9671, longitude: 135.7727 },
  "嵐山": { latitude: 35.0094, longitude: 135.6668 },
  "台北101": { latitude: 25.0338, longitude: 121.5645 },
};

const mockCurrentLocations = {
  tokyo: { latitude: 35.6812, longitude: 139.7671, label: "東京附近" },
  osaka: { latitude: 34.6937, longitude: 135.5023, label: "大阪附近" },
  kyoto: { latitude: 35.0116, longitude: 135.7681, label: "京都附近" },
};

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
type SavedPlace = {
  name: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
};
type PlaceSearchResult = {
  name: string;
  latitude: number;
  longitude: number;
};
export default function HomeScreen() {
  const [videoUrl, setVideoUrl] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [manualPlaceName, setManualPlaceName] = useState("");
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedLocation, setSelectedLocation] =
    useState<keyof typeof mockCurrentLocations>("tokyo");
  const [currentLocation, setCurrentLocation] = useState<{
  latitude: number;
  longitude: number;
} | null>(null);
  const nearbySetRef = useRef<Set<string>>(new Set());
  const searchPlaceByName = async (
  placeName: string
): Promise<PlaceSearchResult | null> => {
  try {
    console.log("開始 Places 搜尋:", placeName);

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.log("缺少 API KEY");
      return null;
    }

    const res = await fetch(
      "https://maps.googleapis.com/maps/api/place/textsearch/json?" +
        `query=${encodeURIComponent(placeName)}&language=zh-TW&region=tw&key=${apiKey}`
    );

    const data = await res.json();

    const result = data.results?.[0];
    const location = result?.geometry?.location;

    if (!result || !location) {
      console.log("Places 找不到:", placeName);
      return null;
    }

    return {
      name: result.name || placeName,
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (error) {
    console.log("Places error:", error);
    return null;
  }
};
const buildSavedPlace = async (
  placeName: string,
  sourceUrl: string
): Promise<SavedPlace | null> => {
  const place = await searchPlaceByName(placeName);

  if (!place) {
    return null;
  }

  return {
    ...place,
    sourceUrl,
  };
};

useEffect(() => {
  const loadFavorites = async () => {
    try {
      const data = await AsyncStorage.getItem("FAVORITE_PLACES");
      if (data) {
        setFavoritePlaces(JSON.parse(data));
      }
    } catch (error) {
      console.log("讀取收藏失敗:", error);
    }
  };

  loadFavorites();
}, []);
useEffect(() => {
  if (favoritePlaces.length > 0 && currentLocation) {
    autoCheckNearby();
  }
}, [favoritePlaces, currentLocation]);

  const handleAnalyzeVideo = async () => {
    const trimmedUrl = videoUrl.trim();

    if (!trimmedUrl) return;

    try {
      const res = await fetch("http://192.168.0.179:8081/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: trimmedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "分析失敗");
        return;
      }

      const placeNames = data.places || [];

const currentSourceUrl = videoUrl;

const placeResults = await Promise.all(
  placeNames.map((placeName: string) =>
    buildSavedPlace(placeName, currentSourceUrl)
  )
);

const validPlaces = placeResults.filter(
  (place): place is SavedPlace => place !== null
);

setSavedPlaces((prev) => {
  const merged = [...prev, ...validPlaces];

  // 避免重複（用 name 當 key）
  const uniqueMap = new Map<string, SavedPlace>();

  merged.forEach((place) => {
    uniqueMap.set(place.name, place);
  });

  return Array.from(uniqueMap.values());
});

      setVideoUrl("");
    } catch (error) {
      console.log("API error:", error);
      alert("請求失敗，請稍後再試");
    }
  };

 const handleFavoritePlace = async (place: string, category: string) => {
  const matchedSavedPlace = savedPlaces.find((item) => item.name === place);
  const sourceUrl = matchedSavedPlace?.sourceUrl || "";
  try {
    console.log("準備收藏:", place);

    const alreadyExists = favoritePlaces.some((item) => item.name === place);
    if (alreadyExists) return;

    let coords = mockCoordinates[place];

    if (!coords) {
  const placeResult = await searchPlaceByName(place);
  console.log("Places 結果:", placeResult);

  if (!placeResult) {
    Alert.alert("收藏失敗", `找不到「${place}」的位置`);
    return;
  }

  coords = {
    latitude: placeResult.latitude,
    longitude: placeResult.longitude,
  };
}

    const updatedFavorites = [
  ...favoritePlaces,
  {
    name: place,
    latitude: coords.latitude,
    longitude: coords.longitude,
    category,
    sourceUrl,
  },
];

    console.log("準備存入收藏:", updatedFavorites);

    setFavoritePlaces(updatedFavorites);

    await AsyncStorage.setItem(
      "FAVORITE_PLACES",
      JSON.stringify(updatedFavorites)
    );
  } catch (error) {
    console.log("儲存收藏失敗:", error);
  }
};

const nearbyPlaces = useMemo(() => {
  if (!currentLocation) return [];

  const categoryFilteredFavorites = favoritePlaces.filter((place) => {
    if (selectedCategory === "全部") return true;
    return place.category === selectedCategory;
  });

  return categoryFilteredFavorites
    .map((place) => {
      const distanceKm = getDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        place.latitude,
        place.longitude
      );

      return {
        ...place,
        distanceKm,
      };
    })
    .filter((place) => place.distanceKm <= 8)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}, [favoritePlaces, currentLocation, selectedCategory]);

const handleCheckNearby = () => {
  if (!currentLocation) {
    Alert.alert("附近提醒", "請先取得目前位置");
    return;
  }

  if (nearbyPlaces.length === 0) {
  const message =
    selectedCategory === "全部"
      ? "你目前附近沒有收藏地點"
      : `你目前附近沒有「${selectedCategory}」收藏地點`;

  Alert.alert("附近提醒", message);
  return;
}

  const placeNames = nearbyPlaces.map((place) => place.name).join("、");

const message =
  selectedCategory === "全部"
    ? `你目前附近有：${placeNames}`
    : `你目前附近的「${selectedCategory}」有：${placeNames}`;

Alert.alert("附近提醒", message);
};

  const handleGetCurrentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("定位權限", "你沒有允許定位權限");
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    setCurrentLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    Alert.alert(
      "目前位置",
      `緯度: ${location.coords.latitude}\n經度: ${location.coords.longitude}`
    );
  } catch (error) {
    console.log("Location error:", error);
    Alert.alert("錯誤", "無法取得目前位置");
  }
};
const autoCheckNearby = async () => {
  if (!currentLocation) return;
  if (favoritePlaces.length === 0) return;

  const currentNearbySet = new Set<string>();

  const nearbyNow = favoritePlaces
    .map((place) => {
      const distanceKm = getDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        place.latitude,
        place.longitude
      );

      return {
        ...place,
        distanceKm,
      };
    })
    .filter((place) => place.distanceKm <= 8);

  // 👉 把目前在附近的地點名稱放進 set
  nearbyNow.forEach((place) => {
    currentNearbySet.add(place.name);
  });

  // 👉 找出「新進入附近」的地點
  const newlyEntered = [...currentNearbySet].filter(
    (name) => !nearbySetRef.current.has(name)
  );

  // 👉 找出「已離開」的地點
  const leftPlaces = [...nearbySetRef.current].filter(
    (name) => !currentNearbySet.has(name)
  );

  // 👉 如果有新進入 → 提醒
  if (newlyEntered.length > 0) {
    Alert.alert("附近提醒", `你目前附近有：${newlyEntered.join("、")}`);
  }

  // 👉 更新目前狀態
  nearbySetRef.current = currentNearbySet;
};
const isPlaceFavorited = (placeName: string) => {
  return favoritePlaces.some((item) => item.name === placeName);
};
const handleUnfavoritePlace = async (placeName: string) => {
  try {
    const updatedFavorites = favoritePlaces.filter(
      (item) => item.name !== placeName
    );

    setFavoritePlaces(updatedFavorites);

    await AsyncStorage.setItem(
      "FAVORITE_PLACES",
      JSON.stringify(updatedFavorites)
    );
  } catch (error) {
    console.log("取消收藏失敗:", error);
  }
};
const openInMaps = (place: SavedPlace) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  Linking.openURL(url);
};
const handleFavoriteWithCategory = (place: string) => {
  Alert.alert("選擇分類", `請選擇「${place}」的分類`, [
    {
      text: "景點類",
      onPress: () => handleFavoritePlace(place, "景點類"),
    },
    {
      text: "餐廳類",
      onPress: () => handleFavoritePlace(place, "餐廳類"),
    },
    {
      text: "藝文活動類",
      onPress: () => handleFavoritePlace(place, "藝文活動類"),
    },
    {
      text: "取消",
      style: "cancel",
    },
  ]);
};
const getCategoryStyle = (category: string) => {
  switch (category) {
    case "餐廳類":
      return {
        backgroundColor: "#fee2e2",
        color: "#b91c1c",
      };
    case "景點類":
      return {
        backgroundColor: "#dbeafe",
        color: "#1d4ed8",
      };
    case "藝文活動類":
      return {
        backgroundColor: "#ede9fe",
        color: "#6d28d9",
      };
    default:
      return {
        backgroundColor: "#e5e7eb",
        color: "#374151",
      };
  }
};
const filteredFavoritePlaces = favoritePlaces.filter((item) => {
  if (selectedCategory === "全部") return true;
  return item.category === selectedCategory;
});
const handleManualSearchPlace = async () => {
  const trimmedName = manualPlaceName.trim();

  if (!trimmedName) {
    Alert.alert("請輸入地點名稱");
    return;
  }

  try {
    const place = await buildSavedPlace(trimmedName, "");

    if (!place) {
      Alert.alert("找不到地點", `找不到「${trimmedName}」`);
      return;
    }

    setSavedPlaces((prev) => {
      const exists = prev.some((item) => item.name === place.name);
      if (exists) return prev;
      return [...prev, place];
    });

    setManualPlaceName("");
    Alert.alert("成功", `已加入「${place.name}」到已擷取地點`);
  } catch (error) {
    console.log("手動搜尋地點失敗:", error);
    Alert.alert("錯誤", "手動搜尋失敗");
  }
};

 return (
  <ScrollView
    contentContainerStyle={{
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 40,
      backgroundColor: "#ffffff",
    }}
  >
      <Text
        style={{
          fontSize: 30,
          fontWeight: "700",
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        Travel App
      </Text>

      <Text
        style={{
          fontSize: 16,
          color: "#666666",
          marginBottom: 12,
        }}
      >
        貼上 Reels / Shorts 影片連結
      </Text>

      <TextInput
        value={videoUrl}
        onChangeText={setVideoUrl}
        placeholder="例如：https://youtube.com/shorts/..."
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#d0d0d0",
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          marginBottom: 16,
        }}
      />

      <Pressable
  onPress={handleAnalyzeVideo}
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#333333" : "#111111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
    transform: [{ scale: pressed ? 0.98 : 1 }],
  })}
>
        <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
          分析影片地點
        </Text>
      </Pressable>
      <Text
  style={{
    fontSize: 16,
    color: "#666666",
    marginBottom: 12,
  }}
>
  或直接輸入店名 / 地點名稱
</Text>

<TextInput
  value={manualPlaceName}
  onChangeText={setManualPlaceName}
  placeholder="例如：台北101、東引小吃店"
  style={{
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  }}
/>

<Pressable
  onPress={handleManualSearchPlace}
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#374151" : "#4b5563",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
    transform: [{ scale: pressed ? 0.98 : 1 }],
  })}
>
  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
    手動搜尋地點
  </Text>
</Pressable>

      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
  目前位置
</Text>
<Pressable
  onPress={handleGetCurrentLocation}
  style={{
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  }}
>
  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
    取得目前位置
  </Text>
</Pressable>
{currentLocation && (
  <View
    style={{
      backgroundColor: "#eef2ff",
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
    }}
  >
    <Text>目前緯度: {currentLocation.latitude}</Text>
    <Text>目前經度: {currentLocation.longitude}</Text>
  </View>
)}
      <Pressable
        onPress={handleCheckNearby}
        style={{
          backgroundColor: "#2d6cdf",
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
          檢查附近收藏地點
        </Text>
      </Pressable>

      <Text
  style={{
    fontSize: 22,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  }}
>
  已擷取地點
</Text>

{savedPlaces.length === 0 ? (
  <Text style={{ color: "#666666", marginTop: 8 }}>
    目前還沒有擷取到地點
  </Text>
) : (
  savedPlaces.map((item, index) => {
  const favorited = isPlaceFavorited(item.name);

  const distanceText = currentLocation
  ? getDistanceKm(
      currentLocation.latitude,
      currentLocation.longitude,
      item.latitude,
      item.longitude
    ).toFixed(2)
  : null;

  return (
  <Pressable
    key={`saved-${item.name}-${index}`}
    onPress={() => openInMaps(item)}
    style={{
      backgroundColor: "#eaeaea",
      padding: 16,
      borderRadius: 12,
      marginBottom: 10,
    }}
  >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              flex: 1,
              marginRight: 12,
            }}
          >
            {item.name}
          </Text>

          {favorited ? (
            <View
              style={{
                backgroundColor: "#d1d5db",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#111111", fontWeight: "600" }}>
                已收藏
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => handleFavoriteWithCategory(item.name)}
              style={{
                backgroundColor: "#111111",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                收藏
              </Text>
            </Pressable>
          )}
        </View>
        {distanceText && (
  <Text style={{ color: "#2563eb", marginTop: 8 }}>
    距離你目前位置：{distanceText} km
  </Text>
)}
<Text style={{ color: "#999999", marginTop: 6 }}>
  點擊可開啟地圖
</Text>
      </Pressable>
    );
  })
)}
<Text
  style={{
    fontSize: 22,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  }}
>
  我的收藏地點
</Text>
<View
  style={{
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  }}
>
  {["全部", "餐廳類", "景點類", "藝文活動類"].map((cat) => (
    <Pressable
      key={cat}
      onPress={() => setSelectedCategory(cat)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: selectedCategory === cat ? "#111111" : "#d1d5db",
      }}
    >
      <Text
        style={{
          color: selectedCategory === cat ? "#ffffff" : "#111111",
          fontWeight: "600",
        }}
      >
        {cat}
      </Text>
    </Pressable>
  ))}
</View>

{filteredFavoritePlaces.length === 0 ? (
  <Text style={{ color: "#666666", marginTop: 8 }}>
    這個分類目前沒有收藏地點
  </Text>
) : (
 filteredFavoritePlaces.map((item, index) => {
  const categoryStyle = getCategoryStyle(item.category);
  const distanceText = currentLocation
    ? getDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        item.latitude,
        item.longitude
      ).toFixed(2)
    : null;

  return (
    <View
      key={`fav-${item.name}-${index}`}
      style={{
        backgroundColor: "#eaeaea",
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            flex: 1,
            marginRight: 12,
          }}
        >
          {item.name}
        </Text>

        <Text
          style={{
            alignSelf: "flex-start",
            marginTop: 6,
            backgroundColor: categoryStyle.backgroundColor,
            color: categoryStyle.color,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {item.category}
        </Text>

        <Pressable
  onPress={() => handleUnfavoritePlace(item.name)}
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#9ca3af" : "#d1d5db",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  })}
>
          <Text style={{ color: "#111111", fontWeight: "600" }}>
            取消收藏
          </Text>
        </Pressable>
      </View>

      <Text style={{ color: "#666666" }}>
        緯度: {item.latitude}
      </Text>

      <Text style={{ color: "#666666" }}>
        經度: {item.longitude}
      </Text>

      {distanceText && (
        <Text style={{ color: "#2563eb", marginTop: 6 }}>
          距離你目前位置：{distanceText} km
        </Text>
      )}

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <Pressable
  onPress={() => openInMaps(item)}
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#1d4ed8" : "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  })}
>
          <Text style={{ color: "white", fontWeight: "600" }}>
            開啟地圖
          </Text>
        </Pressable>

        {item.sourceUrl ? (
          <Pressable
  onPress={() => Linking.openURL(item.sourceUrl)}
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#333333" : "#111111",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  })}
>
            <Text style={{ color: "white", fontWeight: "600" }}>
              查看來源影片
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
})
)}
  </ScrollView>
);
}