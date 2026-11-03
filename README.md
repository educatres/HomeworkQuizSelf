# Homework Quiz Self

學生上傳一份作業，使用自己的 API Key 產生練習，直接在同一網頁作答、批改並查看唯讀結果。選擇題由瀏覽器計分，問答題由 AI 依出題時產生的評分規準逐項評閱，程式驗證後計分。低信心或失敗的題目保留待評狀態，可個別補評。離線示範可體驗表單及選擇題計分。

作業、草稿和結果保存在此瀏覽器的 IndexedDB，可用「清除練習」刪除。出題與批改需要連線，必要的文字會傳給所選供應商。金鑰預設只保留在當前頁面，可選擇記住或隨時清除。瀏覽器中的結果供自我練習使用。

## 開發

使用 Node.js 22。

```sh
npm ci
npm run dev
npm test
npm run build
```

## GitHub Pages

在 repository 的 Settings → Pages 將來源設為 GitHub Actions。推送至 `main` 後，工作流程會執行測試、建置並部署 `dist/`。Vite 使用相對資源路徑，可放在 repository 子路徑。無需伺服器或 GitHub Secrets。

站點 https://educatres.github.io/HomeworkQuizSelf/

## License
