package com.metl.persisted

import com.metl.utils._
import com.metl.data._

abstract class PersistedAdaptor(name:String,host:String,onConversationUpdated:Conversation=>Unit) extends ServerConfiguration(name,host,onConversationUpdated){
  protected val dbInterface:PersistenceInterface
  protected lazy val history = new PersistedHistory(this,dbInterface)
  protected lazy val conversations = new PersistedConversations(this,dbInterface,onConversationUpdated)
  protected lazy val resourceProvider = new PersistedResourceProvider(this,dbInterface)
  protected lazy val profileProvider = new PersistedProfileProvider(this,dbInterface)
  override def shutdown = {
    dbInterface.shutdown
    super.shutdown
  }
  override def isReady = {
    dbInterface.isReady
    super.isReady
  }
  override lazy val messageBusProvider:MessageBusProvider = new PersistingMessageBusProvider(this,dbInterface)
  override def getHistory(jid:String) = history.getMeTLHistory(jid)
  override def getAllConversations = conversations.getAllConversations
  override def getAllSlides = conversations.getAllSlides
  override def searchForConversation(query:String) = conversations.searchForConversation(query)
  override def searchForConversationByCourse(courseId:String) = conversations.searchByCourse(courseId)
  override def searchForSlide(query:String) = conversations.searchForSlide(query)
  override def queryAppliesToSlide(query:String,slide:Slide) = conversations.queryAppliesToSlide(query,slide)
  override def queryAppliesToConversation(query:String,conversation:Conversation) = conversations.queryAppliesToConversation(query,conversation)
  override def detailsOfConversation(jid:String) = conversations.detailsOf(jid)
  override def detailsOfSlide(jid:String) = conversations.detailsOfSlide(jid)
  override def getConversationsForSlideId(jid:String) = conversations.getConversationsForSlideId(jid)
  override def createConversation(title:String,author:String) = conversations.createConversation(title,author)
  override def createSlide(author:String,slideType:String = "SLIDE",grouping:List[GroupSet] = Nil):Slide = conversations.createSlide(author,slideType,grouping)
  override def deleteConversation(jid:String):Conversation = conversations.deleteConversation(jid)
  override def renameConversation(jid:String,newTitle:String):Conversation = conversations.renameConversation(jid,newTitle)
  override def changePermissions(jid:String,newPermissions:Permissions):Conversation = conversations.changePermissions(jid,newPermissions)
  override def updateSubjectOfConversation(jid:String,newSubject:String):Conversation = conversations.updateSubjectOfConversation(jid,newSubject)
  override def addSlideAtIndexOfConversation(jid:String,index:Int,slideType:String):Conversation = conversations.addSlideAtIndexOfConversation(jid,index,slideType)
  override def addGroupSlideAtIndexOfConversation(jid:String,index:Int,grouping:GroupSet):Conversation = conversations.addGroupSlideAtIndexOfConversation(jid,index,grouping)
  override def reorderSlidesOfConversation(jid:String,newSlides:List[Slide]):Conversation = conversations.reorderSlidesOfConversation(jid,newSlides)
  override def updateConversation(jid:String,conversation:Conversation):Conversation = conversations.updateConversation(jid,conversation)
  override def getImage(jid:String,identity:String) = history.getMeTLHistory(jid).getImageByIdentity(identity).getOrElse(MeTLImage.empty)
  override def getResource(jid:String,url:String) = resourceProvider.getResource(url)
  override def postResource(jid:String,userProposedId:String,data:Array[Byte]):String = resourceProvider.postResource(jid,userProposedId,data)
  override def insertResource(jid:String,data:Array[Byte]):String = resourceProvider.insertResource(data,jid)
  override def upsertResource(jid:String,identifier:String,data:Array[Byte]):String = resourceProvider.upsertResource(identifier,data,jid)
  override def getImage(identity:String):MeTLImage = MeTLImage.empty
  override def getResource(identifier:String):Array[Byte] = resourceProvider.getResource(identifier)
  override def insertResource(data:Array[Byte]):String = resourceProvider.insertResource(data)
  override def upsertResource(identifier:String,data:Array[Byte]):String = resourceProvider.upsertResource(identifier,data)
  override def getAllProfiles:List[Profile] = profileProvider.getAllProfiles
  override def getProfiles(ids:String *):List[Profile] = profileProvider.getProfiles(ids:_*)
  override def createProfile(name:String,attrs:Map[String,String],audiences:List[Audience] = Nil):Profile = profileProvider.createProfile(name,attrs)
  override def updateProfile(id:String,profile:Profile):Profile = profileProvider.updateProfile(id,profile)
  override def getProfileIds(accountName:String,accountProvider:String):Tuple2[List[String],String] = profileProvider.getProfileIds(accountName,accountProvider)
  override def updateAccountRelationship(accountName:String,accountProvider:String,profileId:String,disabled:Boolean = false, default:Boolean = false):Unit = profileProvider.updateAccountRelationship(accountName,accountProvider,profileId,disabled,default)
  override def getSessionsForAccount(accountName:String,accountProvider:String):List[SessionRecord] = dbInterface.getSessionsForAccount(accountName,accountProvider)
  override def getSessionsForProfile(profileId:String):List[SessionRecord] = dbInterface.getSessionsForProfile(profileId)
  override def updateSession(sessionRecord:SessionRecord):SessionRecord = dbInterface.updateSession(sessionRecord)
  override def getCurrentSessions:List[SessionRecord] = dbInterface.getCurrentSessions

  override def getThemesByAuthor(author:String):List[Theme] = dbInterface.getThemesByAuthor(author)
  override def getSlidesByThemeKeyword(theme:String):List[String] = dbInterface.getSlidesByThemeKeyword(theme)
  override def getConversationsByTheme(theme:String):List[String] = dbInterface.getConversationsByTheme(theme)
  override def getAttendancesByAuthor(author:String):List[Attendance] = dbInterface.getAttendancesByAuthor(author)
  override def getConversationsByAuthor(author:String):List[Conversation] = dbInterface.getConversationsByAuthor(author)
  override def getAuthorsByTheme(theme:String):List[String] = dbInterface.getAuthorsByTheme(theme)
}
