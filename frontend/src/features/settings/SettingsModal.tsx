import React, { useEffect, useState } from 'react';
import {
  Settings,
  Monitor,
  Keyboard,
  Sparkles,
  Bell,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';
import { Slider } from '@/shared/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { apiService } from '@/shared/lib/api';

const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen } = useEditorStore();
  const { settings, updateSetting } = useSettingsStore();
  const [aiConfig, setAiConfig] = useState<{ model: string; ready: boolean; provider: string } | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      apiService.makePublicRequest<{ model: string; ready: boolean; provider: string }>('/ai/config')
        .then(setAiConfig)
        .catch(() => {});
    }
  }, [isSettingsOpen]);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="editor" className="text-xs">
              <Monitor className="h-3.5 w-3.5 mr-1.5" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              AI
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="text-xs">
              <Keyboard className="h-3.5 w-3.5 mr-1.5" />
              Keys
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Font Size</Label>
                  <p className="text-xs text-muted-foreground">Editor font size in pixels</p>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[settings.fontSize]}
                    onValueChange={([v]) => updateSetting('fontSize', v)}
                    min={10}
                    max={24}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-sm w-8">{settings.fontSize}px</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tab Size</Label>
                  <p className="text-xs text-muted-foreground">Number of spaces per tab</p>
                </div>
                <Select
                  value={String(settings.tabSize)}
                  onValueChange={(v) => updateSetting('tabSize', Number(v))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Word Wrap</Label>
                  <p className="text-xs text-muted-foreground">Wrap long lines</p>
                </div>
                <Switch
                  checked={settings.wordWrap}
                  onCheckedChange={(v) => updateSetting('wordWrap', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Minimap</Label>
                  <p className="text-xs text-muted-foreground">Show code overview</p>
                </div>
                <Switch
                  checked={settings.minimap}
                  onCheckedChange={(v) => updateSetting('minimap', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Line Numbers</Label>
                  <p className="text-xs text-muted-foreground">Display line numbers</p>
                </div>
                <Switch
                  checked={settings.lineNumbers}
                  onCheckedChange={(v) => updateSetting('lineNumbers', v)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="space-y-4">
              {aiConfig && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm font-medium">Active Model</Label>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${aiConfig.ready ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {aiConfig.ready ? 'Connected' : 'Not configured'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{aiConfig.model}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Provider: {aiConfig.provider} &middot; Change via OPENROUTER_MODEL in .env</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-Analysis</Label>
                  <p className="text-xs text-muted-foreground">Analyze code as you type</p>
                </div>
                <Switch
                  checked={settings.autoAnalysis}
                  onCheckedChange={(v) => updateSetting('autoAnalysis', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Analysis Delay</Label>
                  <p className="text-xs text-muted-foreground">Seconds after typing stops</p>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[settings.analysisDelay / 1000]}
                    onValueChange={([v]) => updateSetting('analysisDelay', v * 1000)}
                    min={0.5}
                    max={5}
                    step={0.5}
                    className="w-24"
                  />
                  <span className="text-sm w-8">{(settings.analysisDelay / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="keyboard" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Save</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Cmd S</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Find</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Cmd F</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Command Palette</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Cmd Shift P</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Toggle Sidebar</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Cmd B</kbd>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Notification settings will be available after authentication is implemented.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
