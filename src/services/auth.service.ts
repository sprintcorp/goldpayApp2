import { Injectable, HttpException, HttpStatus, Res } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../models/user.schema";
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from "@nestjs/event-emitter";
import { AuthDto } from "../dto/auth.dto";
import { Helper } from "../utils/helper";
import { AuthResponse } from "../transformers/auth.response";

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
  }

  @OnEvent('verify_mail')
  async signup(user: AuthDto, @Res() response): Promise<AuthResponse> {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(user.password, salt);
    const reqBody = {
      referral_code: user.referral_code,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      password: hash
    }
    // try{
    const newUser = new this.userModel(reqBody);
    return newUser.save()
    // }catch (e) {
    //   console.log('hellooooo '+ e.getMessage());
    // }
  }

  async signin(user, jwt: JwtService): Promise<any> {

    let foundUser = await this.userModel.findOne({ email: user.email,active:true }).exec();
    if(user.username && user.username !== ''){
      foundUser = await this.userModel.findOne({ username: user.username,active:true }).exec();
    }

    if (foundUser) {
      const { password } = foundUser;
      if (await bcrypt.compare(user.password, password)) {
        const payload = { email: foundUser.email };
        return {
          'response': jwt.sign(payload),
          'status':HttpStatus.OK
        };
      }
      return {'response':"Incorrect username or password", 'status':HttpStatus.UNAUTHORIZED}
    }
    return {'response':"User does not exit within the system", 'status':HttpStatus.NOT_FOUND}
  }

  async activateAccount(user: User): Promise<any> {
    const foundUser = await this.userModel.findOne({ email: user.email,active:false }).exec();

    if(foundUser){
      if(foundUser.otp === user.otp){
        await this.userModel.findByIdAndUpdate(foundUser._id, {active:true});
        return "User activated successfully.";
      }else{
        return new HttpException('Invalid OTP', HttpStatus.UNAUTHORIZED)
      }
    }else{
      return new HttpException('User not found', HttpStatus.NOT_FOUND)
    }
  }

  async sendVerificationOTP(user: User): Promise<any>{
    let foundUser = await this.userModel.findOne({ email: user.email,active:false }).exec();
    if(user.username && user.username !== ''){
      foundUser = await this.userModel.findOne({ username: user.username,active:false }).exec();
    }
    if(foundUser){
        const otp = Math.floor(100000 + Math.random() * 900000);
        await this.userModel.findByIdAndUpdate(foundUser._id, {otp:otp, expiryDate:Helper.addTime(15)});
        return otp;
    }else{
      throw new HttpException('User not found', HttpStatus.NOT_FOUND)
    }
  }

  async sendPasswordOTP(user: User): Promise<any>{
    let foundUser = await this.userModel.findOne({ email: user.email,active:true }).exec();
    if(user.username && user.username !== ''){
      foundUser = await this.userModel.findOne({ username: user.username,active:true }).exec();
    }
    if(foundUser){
      const otp = Math.floor(100000 + Math.random() * 900000);
      await this.userModel.findByIdAndUpdate(foundUser._id, {otp:otp, expiryDate:Helper.addTime(15)});
      return otp;
    }else{
      throw new HttpException('User not found', HttpStatus.NOT_FOUND)
    }
  }

  async resetPassword(user): Promise<any>{
    let foundUser = await this.userModel.findOne({ email: user.email,otp:user.otp }).exec();

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(user.password, salt);

    if(foundUser){
      const otp = Math.floor(100000 + Math.random() * 900000);
      await this.userModel.findByIdAndUpdate(foundUser._id, {password:hash});
      return {'response':"Password reset successfully", 'status':HttpStatus.OK}
    }else{
      throw new HttpException('User not found', HttpStatus.NOT_FOUND)
    }
  }

  async pinLogin(user, jwt: JwtService): Promise<any> {
    let foundUser = await this.userModel.findOne({ email: user.email, login_pin: user.login_pin, active:true }).exec();

    if (foundUser) {
        const payload = { email: foundUser.email };
        return {
          'response': jwt.sign(payload),
          'status':HttpStatus.OK
        };
      }else {
      return { 'response': "Invalid user pin", 'status': HttpStatus.UNAUTHORIZED }
    }

    return {'response':"User does not exit within the system", 'status':HttpStatus.NOT_FOUND}
  }

  async updateUser(user, request): Promise<any>{
    const response = await this.userModel.findByIdAndUpdate(request.user._id, user)
    return { 'response': response, 'status': HttpStatus.OK }
  }

  async getOne(email): Promise<User> {
    return await this.userModel.findOne({ email }).exec();
  }

}
