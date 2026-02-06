import React from 'react';
import {
  Settings,
  Monitor,
  Keyboard,
  Sparkles,
  Bell,
  Palette,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorStore } from '@/stores/editorStore';

const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen } = useEditorStore();

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
                    defaultValue={[14]}
                    min={10}
                    max={24}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-sm w-8">14px</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Tab Size</Label>
                  <p className="text-xs text-muted-foreground">Number of spaces per tab</p>
                </div>
                <Select defaultValue="2">
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
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Minimap</Label>
                  <p className="text-xs text-muted-foreground">Show code overview</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Line Numbers</Label>
                  <p className="text-xs text-muted-foreground">Display line numbers</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">AI Suggestions</Label>
                  <p className="text-xs text-muted-foreground">Enable real-time suggestions</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-complete</Label>
                  <p className="text-xs text-muted-foreground">AI-powered code completion</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Error Detection</Label>
                  <p className="text-xs text-muted-foreground">Highlight potential issues</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Suggestion Confidence</Label>
                  <p className="text-xs text-muted-foreground">Minimum confidence threshold</p>
                </div>
                <Select defaultValue="70">
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="70">70%</SelectItem>
                    <SelectItem value="90">90%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="keyboard" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Save</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘ S</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Find</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘ F</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Command Palette</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘ ⇧ P</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Toggle Sidebar</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘ B</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">AI Suggestions</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘ I</kbd>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Collaborator Joins</Label>
                  <p className="text-xs text-muted-foreground">When someone joins the document</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Chat Messages</Label>
                  <p className="text-xs text-muted-foreground">New messages in chat</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">AI Alerts</Label>
                  <p className="text-xs text-muted-foreground">Critical AI suggestions</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Sound Effects</Label>
                  <p className="text-xs text-muted-foreground">Notification sounds</p>
                </div>
                <Switch />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
