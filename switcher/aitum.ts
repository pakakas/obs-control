export async function switchVerticalScene(config, obs, matchedScene) {
  // 2. Switch Scene di Kanvas Aitum Vertical via Vendor Request API
  try {
    // Karena Aitum tidak mem-publish daftar scene vertikal via WebSocket, 
    // kita gunakan mapping eksplisit dari config, atau fallback ke prefix default "v-"
    const vSceneName = config.vertical_scenes?.[matchedScene] || ("v-" + matchedScene);
    
    const vRes = await obs.call("CallVendorRequest", {
      vendorName: "aitum-vertical-canvas",
      requestType: "switch_scene",
      requestData: { scene: vSceneName }
    });
    if (vRes?.responseData?.success) {
      // console.log(`[switcher] "${vSceneName}"`);
    }
  } catch (vErr: any) {
    // Jangan print error jika scene vertikal memang tidak ada (untuk menghindari spam log)
    if (!vErr.message.includes("No request was found")) {
      console.error("❌ Gagal switch Aitum Vertical:", vErr.message);
    }
  }
}