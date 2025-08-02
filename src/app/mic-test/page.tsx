'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function MicTestPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceInfos);
        
        // デフォルトのデバイスを設定
        const audioInputs = deviceInfos.filter(device => device.kind === 'audioinput');
        const audioOutputs = deviceInfos.filter(device => device.kind === 'audiooutput');
        
        if (audioInputs.length > 0 && !selectedInput) {
          setSelectedInput(audioInputs[0].deviceId);
        }
        if (audioOutputs.length > 0 && !selectedOutput) {
          setSelectedOutput(audioOutputs[0].deviceId);
        }
      } catch (error) {
        console.error('デバイス取得エラー:', error);
      }
    }
    fetchDevices();
    
    return () => {
      stopTest();
    };
  }, [selectedInput, selectedOutput]);

  const handleInputChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedInput(event.target.value);
  };

  const handleOutputChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOutput(event.target.value);
  };

  const startTest = async () => {
    try {
      setTestResult(null);
      setErrorMessage('');
      
      // 選択されたデバイスを使用してマイクへのアクセスを要求
      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      
      // AudioContextを作成
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // 音声分析用のノードを作成
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      
      analyserRef.current = analyser;
      analyser.fftSize = 2048; // より高精度な分析のため増加
      analyser.smoothingTimeConstant = 0.8; // スムージングを追加
      
      // ノードを接続
      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(audioContext.destination);
      
      // 音量を設定
      gainNode.gain.value = volume / 100;
      
      // 音声レベルを監視
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isTesting) {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // より正確な音声レベル計算
          let sum = 0;
          let count = 0;
          for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > 0) {
              sum += dataArray[i];
              count++;
            }
          }
          const average = count > 0 ? sum / count : 0;
          
          // 音声レベルを正規化（0-100の範囲）
          const normalizedLevel = Math.min(100, (average / 255) * 100);
          setAudioLevel(normalizedLevel);

          // インジケーターの更新
          const indicatorElement = document.getElementById('audio-indicator');
          if (indicatorElement) {
            indicatorElement.style.width = `${normalizedLevel}%`;
            indicatorElement.style.backgroundColor = normalizedLevel > 30 ? 'green' : 'red';
          }

          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      setIsTesting(true);
      updateAudioLevel();
      
      // 5秒後に自動停止
      setTimeout(() => {
        if (isTesting) {
          stopTest();
          setTestResult('success');
        }
      }, 5000);
      
    } catch (error) {
      console.error('マイクテストエラー:', error);
      setErrorMessage('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      setTestResult('error');
    }
  };

  const stopTest = () => {
    setIsTesting(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setAudioLevel(0);
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    // 音量調整を即座に反映
    if (audioContextRef.current && streamRef.current) {
      // 既存のgainNodeを更新するのではなく、新しいgainNodeを作成
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      const gainNode = audioContextRef.current.createGain();
      const analyser = audioContextRef.current.createAnalyser();
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(audioContextRef.current.destination);
      
      // 新しい音量を設定
      gainNode.gain.value = newVolume / 100;
      
      // 既存のanalyserRefを更新
      analyserRef.current = analyser;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            onClick={() => window.close()}
            variant="outline" 
            size="sm" 
            className="flex items-center bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-2xl font-bold text-white">マイクテスト</h1>
          <div className="w-20"></div> {/* スペーサー */}
        </div>

        {/* メインカード */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
          {/* マイクアイコン */}
          <div className="text-center mb-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
              isTesting 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg' 
                : 'bg-gray-700'
            }`}>
              {isTesting ? (
                <Mic className="w-12 h-12 text-white" />
              ) : (
                <MicOff className="w-12 h-12 text-gray-400" />
              )}
            </div>
            
            {/* 音声レベルメーター */}
            {isTesting && (
              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  id="audio-indicator"
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>
            )}
            
            <p className="text-gray-300 text-sm">
              {isTesting ? 'マイクテスト中... 話してみてください' : 'マイクのテストを開始します'}
            </p>
          </div>

          {/* テスト結果 */}
          {testResult && (
            <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
              testResult === 'success' 
                ? 'bg-green-900/50 border border-green-600' 
                : 'bg-red-900/50 border border-red-600'
            }`}>
              {testResult === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={`text-sm ${
                testResult === 'success' ? 'text-green-300' : 'text-red-300'
              }`}>
                {testResult === 'success' 
                  ? 'マイクテストが完了しました！' 
                  : errorMessage
                }
              </span>
            </div>
          )}

          {/* コントロール */}
          <div className="space-y-4">
            {/* デバイス選択 */}
            <div className="space-y-3">
              <h3 className="text-white font-semibold">デバイス選択</h3>
              
              {/* 入力デバイス選択 */}
              <div className="space-y-1">
                <label className="text-sm text-gray-300">入力デバイス:</label>
                <select 
                  onChange={handleInputChange} 
                  value={selectedInput}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                >
                  {devices
                    .filter(device => device.kind === 'audioinput')
                    .map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `マイク ${device.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                </select>
              </div>
              
              {/* 出力デバイス選択 */}
              <div className="space-y-1">
                <label className="text-sm text-gray-300">出力デバイス:</label>
                <select 
                  onChange={handleOutputChange} 
                  value={selectedOutput}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                >
                  {devices
                    .filter(device => device.kind === 'audiooutput')
                    .map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `スピーカー ${device.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* テスト開始/停止ボタン */}
            <Button
              onClick={isTesting ? stopTest : startTest}
              variant={isTesting ? "destructive" : "default"}
              size="lg"
              className={`w-full ${
                isTesting 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isTesting ? 'テスト停止' : 'テスト開始'}
            </Button>

            {/* ミュート切り替え */}
            {isTesting && (
              <Button
                onClick={toggleMute}
                variant="outline"
                size="sm"
                className="w-full bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 mr-2" />
                    ミュート解除
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 mr-2" />
                    ミュート
                  </>
                )}
              </Button>
            )}

            {/* 音量調整 */}
            {isTesting && (
              <div className="space-y-2">
                <label className="text-sm text-gray-300">音量調整</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span>{volume}%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>

          {/* 説明 */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-white font-semibold mb-2">テストの手順</h3>
            <ol className="text-sm text-gray-300 space-y-1">
              <li>1. 「テスト開始」ボタンをクリック</li>
              <li>2. ブラウザのマイク許可を承認</li>
              <li>3. 話して音声レベルを確認</li>
              <li>4. 5秒後に自動停止、または手動で停止</li>
            </ol>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
} 