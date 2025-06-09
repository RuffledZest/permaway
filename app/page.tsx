"use client"

import { useState } from "react"
import { Github, Upload, Loader2, ExternalLink, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { deployToArweave } from "@/lib/deploy"
import { processGithubRepo } from "@/lib/process-github"
import { processZipFile } from "@/lib/zip-processing"
import { processHtml, processMhtml, processUrlContent } from "@/lib/html-processor"
import { ShineBorder } from "@/components/magicui/shine-border"
import ParticlesBackground from "@/components/ardacity/particles-background"


export default function Home() {
  
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployedUrls, setDeployedUrls] = useState<string[]>([])
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleUrlDeploy = async () => {
    if (!url) {
      setError("Please enter a URL")
      return
    }

    setIsLoading(true)
    setError(null)
    setDeployedUrls([])

    try {
      const html = await processUrlContent(url)
      const size = new Blob([html]).size / 1024 // Size in KB
      setFileSize(size)

      if (size > 3000) {
        setError(`HTML file size (${size.toFixed(2)}KB) exceeds 3MB limit. Please use a smaller project.`)
        setIsLoading(false)
        return
      }

      const result = await deployToArweave(html)
      if (result.success) {
        setDeployedUrls(result.links)
      } else {
        setError("Deployment failed. Please try again.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubDeploy = async () => {
    if (!url) {
      setError("Please enter a GitHub repository URL")
      return
    }

    setIsLoading(true)
    setError(null)
    setDeployedUrls([])

    try {
      console.log("Starting GitHub deployment for:", url)
      const html = await processGithubRepo(url)
      const size = new Blob([html]).size / 1024 // Size in KB
      setFileSize(size)

      console.log(`Generated HTML size: ${size.toFixed(2)}KB`)

      if (size > 3000) {
        setError(`HTML file size (${size.toFixed(2)}KB) exceeds 3MB limit. Please use a smaller project.`)
        setIsLoading(false)
        return
      }

      const result = await deployToArweave(html)
      if (result.success) {
        setDeployedUrls(result.links)
        console.log("Deployment successful:", result.links)
      } else {
        setError("Deployment failed. Please try again.")
      }
    } catch (err) {
      console.error("GitHub deployment error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setError(null)
    }
  }

  const handleFileDeploy = async () => {
    if (!selectedFile) {
      setError("Please select a file")
      return
    }

    setIsLoading(true)
    setError(null)
    setDeployedUrls([])

    try {
      let html: string

      if (selectedFile.name.endsWith('.html')) {
        const content = await selectedFile.text()
        html = processHtml(content)
      } else if (selectedFile.name.endsWith('.mhtml')) {
        const content = await selectedFile.text()
        html = processMhtml(content)
      } else if (selectedFile.name.endsWith('.zip')) {
        html = await processZipFile(selectedFile)
      } else {
        throw new Error("Unsupported file type. Please upload an HTML, MHTML, or ZIP file.")
      }

      const size = new Blob([html]).size / 1024 // Size in KB
      setFileSize(size)

      if (size > 3000) {
        setError(`HTML file size (${size.toFixed(2)}KB) exceeds 3MB limit. Please use a smaller project.`)
        setIsLoading(false)
        return
      }

      const result = await deployToArweave(html)
      if (result.success) {
        setDeployedUrls(result.links)
      } else {
        setError("Deployment failed. Please try again.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container max-w-3xl mx-auto py-10 px-4 " >
      <ParticlesBackground className="absolute inset-0 z-[-1]" />
      <div className=" relative flex flex-col items-center text-center mb-10 ">
        
        <h1 className="text-4xl font-bold mb-4 text-transparent ">Arweave Deployer</h1>
        <p className="text-gray-500 max-w-xl text-transparent">
          Deploy your static websites to the Arweave blockchain. Upload from GitHub, URL, or local files.
        </p>
      </div>

      <Tabs defaultValue="url" className="w-full mt-28">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="url">Website URL</TabsTrigger>
          <TabsTrigger value="github">GitHub Repository</TabsTrigger>
          <TabsTrigger value="file">Upload File</TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={"white"} />
            <CardHeader>
              <CardTitle>Deploy from URL</CardTitle>
              <CardDescription>Enter the URL of the website you want to deploy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <Button onClick={handleUrlDeploy} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Deploy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="github">
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={"white"} />
            <CardHeader>
              <CardTitle>Deploy from GitHub</CardTitle>
              <CardDescription>
                Enter the URL of your GitHub repository to deploy
                <br />
                <small className="text-muted-foreground">
                  Example: https://github.com/username/repository
                </small>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://github.com/username/repository"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <Button onClick={handleGithubDeploy} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <Github className="mr-2 h-4 w-4" />
                        Deploy
                      </>
                    )}
                  </Button>
                </div>
                {isLoading && (
                  <div className="text-sm text-muted-foreground">
                    Fetching repository and processing files...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file">
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={"white"} />
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>Upload an HTML, MHTML, or ZIP file containing your project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".html,.htm,.mhtml,.zip"
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                  <Button onClick={handleFileDeploy} disabled={isLoading || !selectedFile}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Deploy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {fileSize !== null && !error && (
        <Alert className="mt-6">
          <AlertDescription>
            HTML file size: {fileSize.toFixed(2)}KB {fileSize > 2700 && "(approaching 3MB limit)"}
          </AlertDescription>
        </Alert>
      )}

      {deployedUrls.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Deployment Successful!</CardTitle>
            <CardDescription>Your site has been deployed to Arweave</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {deployedUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                  <span className="text-sm truncate max-w-[80%]">{url}</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visit
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}